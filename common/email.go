package common

import (
	"bytes"
	"crypto/tls"
	"encoding/base64"
	"fmt"
	"mime"
	"mime/multipart"
	"net/smtp"
	"os"
	"slices"
	"strings"
	"time"
)

func generateMessageID() (string, error) {
	split := strings.Split(SMTPFrom, "@")
	if len(split) < 2 {
		return "", fmt.Errorf("invalid SMTP account")
	}
	domain := strings.Split(SMTPFrom, "@")[1]
	return fmt.Sprintf("<%d.%s@%s>", time.Now().UnixNano(), GetRandomString(12), domain), nil
}

func shouldUseSMTPLoginAuth() bool {
	if SMTPForceAuthLogin {
		return true
	}
	return isOutlookServer(SMTPAccount) || slices.Contains(EmailLoginAuthServerList, SMTPServer)
}

func getSMTPAuth() smtp.Auth {
	if shouldUseSMTPLoginAuth() {
		return LoginAuth(SMTPAccount, SMTPToken)
	}
	return smtp.PlainAuth("", SMTPAccount, SMTPToken, SMTPServer)
}

func buildMailHeaders(subject, receiver string) (string, error) {
	if SMTPFrom == "" { // for compatibility
		SMTPFrom = SMTPAccount
	}
	id, err := generateMessageID()
	if err != nil {
		return "", err
	}
	if SMTPServer == "" && SMTPAccount == "" {
		return "", fmt.Errorf("SMTP 服务器未配置")
	}
	encodedSubject := fmt.Sprintf("=?UTF-8?B?%s?=", base64.StdEncoding.EncodeToString([]byte(subject)))
	header := fmt.Sprintf("To: %s\r\n"+
		"From: %s <%s>\r\n"+
		"Subject: %s\r\n"+
		"Date: %s\r\n"+
		"Message-ID: %s\r\n",
		receiver, SystemName, SMTPFrom, encodedSubject, time.Now().Format(time.RFC1123Z), id)
	return header, nil
}

// sendRawEmail 通过 SMTP 发送完整原始邮件体（含 headers），复用 465/SSL 与 587 两条分支。
func sendRawEmail(raw []byte, receiver string) error {
	auth := getSMTPAuth()
	addr := fmt.Sprintf("%s:%d", SMTPServer, SMTPPort)
	to := strings.Split(receiver, ";")
	var err error
	if SMTPPort == 465 || SMTPSSLEnabled {
		tlsConfig := &tls.Config{
			InsecureSkipVerify: true,
			ServerName:         SMTPServer,
		}
		conn, err := tls.Dial("tcp", fmt.Sprintf("%s:%d", SMTPServer, SMTPPort), tlsConfig)
		if err != nil {
			return err
		}
		client, err := smtp.NewClient(conn, SMTPServer)
		if err != nil {
			return err
		}
		defer client.Close()
		if err = client.Auth(auth); err != nil {
			return err
		}
		if err = client.Mail(SMTPFrom); err != nil {
			return err
		}
		receiverEmails := strings.Split(receiver, ";")
		for _, receiver := range receiverEmails {
			if err = client.Rcpt(receiver); err != nil {
				return err
			}
		}
		w, err := client.Data()
		if err != nil {
			return err
		}
		_, err = w.Write(raw)
		if err != nil {
			return err
		}
		err = w.Close()
		if err != nil {
			return err
		}
	} else {
		err = smtp.SendMail(addr, auth, SMTPFrom, to, raw)
	}
	if err != nil {
		SysError(fmt.Sprintf("failed to send email to %s: %v", receiver, err))
	}
	return err
}

func SendEmail(subject string, receiver string, content string) error {
	header, err := buildMailHeaders(subject, receiver)
	if err != nil {
		return err
	}
	mail := []byte(header +
		"Content-Type: text/html; charset=UTF-8\r\n\r\n" + content + "\r\n")
	return sendRawEmail(mail, receiver)
}

func encodeMIMEBase64(data []byte) []byte {
	encoded := base64.StdEncoding.EncodeToString(data)
	var buf bytes.Buffer
	for len(encoded) > 76 {
		buf.WriteString(encoded[:76])
		buf.WriteString("\r\n")
		encoded = encoded[76:]
	}
	buf.WriteString(encoded)
	buf.WriteString("\r\n")
	return buf.Bytes()
}

// SendEmailWithAttachment 发送 text/html 邮件，并把指定图片作为 multipart/related
// 的 cid 内联附件嵌入（HTML 中以 <img src="cid:<contentID>"> 引用）。
// 若 inlineImagePath 为空或图片读取失败，则退化为普通 text/html 邮件，不因缺图失败。
func SendEmailWithAttachment(subject string, receiver string, htmlContent string, inlineImagePath string) error {
	header, err := buildMailHeaders(subject, receiver)
	if err != nil {
		return err
	}

	// 读取图片（可失败则降级为纯文本）
	imageData, readErr := os.ReadFile(inlineImagePath)
	if readErr != nil || len(imageData) == 0 {
		mail := []byte(header +
			"Content-Type: text/html; charset=UTF-8\r\n\r\n" + htmlContent + "\r\n")
		return sendRawEmail(mail, receiver)
	}

	const contentID = "loveapilogo"
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	// part1: text/html，包含 <img src="cid:loveapilogo">
	htmlHeader := map[string][]string{
		"Content-Type":              {"text/html; charset=UTF-8"},
		"Content-Transfer-Encoding": {"base64"},
	}
	part, err := writer.CreatePart(htmlHeader)
	if err != nil {
		return err
	}
	if _, err = part.Write(encodeMIMEBase64([]byte(htmlContent))); err != nil {
		return err
	}

	// part2: image/png，作为 cid 内联附件
	imageHeader := map[string][]string{
		"Content-Type":              {"image/png"},
		"Content-Transfer-Encoding": {"base64"},
		"Content-ID":                {"<" + contentID + ">"},
		"Content-Disposition":       {"inline; filename=\"loveapi-logo.png\""},
	}
	imgPart, err := writer.CreatePart(imageHeader)
	if err != nil {
		return err
	}
	if _, err = imgPart.Write(encodeMIMEBase64(imageData)); err != nil {
		return err
	}

	if err = writer.Close(); err != nil {
		return err
	}

	contentType := mime.FormatMediaType("multipart/related", map[string]string{"boundary": writer.Boundary()})
	mail := []byte(header +
		"Content-Type: " + contentType + "\r\n\r\n" + buf.String() + "\r\n")
	return sendRawEmail(mail, receiver)
}
