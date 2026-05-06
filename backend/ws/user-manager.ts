import type WebSocket from "ws";
import { User } from "./user";

export class UserManager {
    private users: Map<string,User> = new Map();
    private static instance:UserManager;

    constructor() {

    }

    public static getInstance(){
        if(this.instance) {
            return this.instance
        } else {
            this.instance = new UserManager();
            return this.instance
        }
    }

    getUser(userId:string) {
        const user = this.users.get(userId);
        return user;
    }
    
    addUser(ws:WebSocket) {
        const id = this.getRandomId()
        const user = new User(ws,id);

        this.users.set(id,user);
    }

    private getRandomId() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
}