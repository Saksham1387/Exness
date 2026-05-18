import { WebSocketServer } from "ws";
import { UserManager } from "./user-manager";

const ws = new WebSocketServer({port:3001});

ws.on("connection" ,(ws) => {
  UserManager.getInstance().addUser(ws);
})