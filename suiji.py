import random
import string

def generate_password(length=16):
    # 定义密码字符集：大小写字母 + 数字
    characters = string.ascii_letters + string.digits
    # 随机选择字符生成密码
    password = ''.join(random.choices(characters, k=length))
    return password

# 生成并打印密码
if __name__ == "__main__":
    print("生成的16位随机密码是：", generate_password())