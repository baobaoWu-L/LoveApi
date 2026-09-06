package relay

import (
	"net/http"
	"sync"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

// CanvasEvent is a small user-scoped notification. Image bytes stay in the
// browser's history store; clients use this event only to reload metadata.
type CanvasEvent struct {
	Type      string `json:"type"`
	RequestID string `json:"request_id,omitempty"`
	Model     string `json:"model,omitempty"`
	Message   string `json:"message,omitempty"`
}

type canvasHub struct {
	sync.RWMutex
	clients map[int]map[*websocket.Conn]struct{}
}

var canvasClients = &canvasHub{clients: make(map[int]map[*websocket.Conn]struct{})}

var canvasUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func (h *canvasHub) add(userID int, conn *websocket.Conn) {
	h.Lock()
	if h.clients[userID] == nil {
		h.clients[userID] = make(map[*websocket.Conn]struct{})
	}
	h.clients[userID][conn] = struct{}{}
	h.Unlock()
}

func (h *canvasHub) remove(userID int, conn *websocket.Conn) {
	h.Lock()
	if peers := h.clients[userID]; peers != nil {
		delete(peers, conn)
		if len(peers) == 0 {
			delete(h.clients, userID)
		}
	}
	h.Unlock()
}

// PublishCanvasEvent sends an event to all live sessions for one account.
func PublishCanvasEvent(userID int, event CanvasEvent) {
	if userID <= 0 {
		return
	}
	// Serialize writes while holding the hub lock; gorilla/websocket permits
	// only one concurrent writer per connection.
	canvasClients.Lock()
	defer canvasClients.Unlock()
	for conn := range canvasClients.clients[userID] {
		if err := conn.WriteJSON(event); err != nil {
			delete(canvasClients.clients[userID], conn)
			_ = conn.Close()
		}
	}
	if len(canvasClients.clients[userID]) == 0 {
		delete(canvasClients.clients, userID)
	}
}

// CanvasWebSocket keeps a user-scoped connection open until the browser leaves.
// UserAuth middleware sets the authenticated account id in the Gin context.
func CanvasWebSocket(c *gin.Context) {
	userID := c.GetInt("id")
	if userID <= 0 {
		if id, ok := sessions.Default(c).Get("id").(int); ok {
			userID = id
		}
	}
	if userID <= 0 {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}
	conn, err := canvasUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	canvasClients.add(userID, conn)
	defer func() { canvasClients.remove(userID, conn); _ = conn.Close() }()
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			return
		}
	}
}
