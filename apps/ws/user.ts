import type { WebSocket } from "ws";
import { SubscriptionManager } from "./subscription-manager";

export class User {
    private client: WebSocket;
    private id: string;
    subscriptions: string[] = [];


    constructor(ws:WebSocket,id:string){
        this.client = ws;
        this.id = id;
        this.addEventListner()
    }


    subscribe(channel:string){
        this.subscriptions.push(channel);
    }

    unsubscribe(channel:string){
        this.subscriptions.filter(x => x != channel);
    }

    emit(message:string){
        this.client.send(message);
    }

    addEventListner() {
        this.client.on("message", (message:string) =>{
            const parsedMessage = JSON.parse(message);
            console.log(parsedMessage)
            if (parsedMessage.method === "SUBSCRIBE") {
                parsedMessage.params.forEach((x: string) => SubscriptionManager.getInstance().subscribe(this.id,x));
            }
            
            if (parsedMessage.method === "UNSUBSCRIBE") {
                parsedMessage.params.forEach((x: string) => SubscriptionManager.getInstance().unsubscribe(this.id,x));
            }
        })
    }
}