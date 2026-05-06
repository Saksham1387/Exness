import { createClient, type RedisClientType } from "redis";
import { UserManager } from "./user-manager";


export class SubscriptionManager {
    private static instance : SubscriptionManager;
    private subscriptions: Map<string,string[]> = new Map();
    private reverseSubscriptions: Map<string,string[]> = new Map();
    private rediClient : RedisClientType

    constructor() {
        this.rediClient = createClient();
        this.rediClient.connect();
    }

    public static getInstance() {
        if(this.instance) {
            return this.instance
        } else {
            this.instance = new SubscriptionManager();
            return this.instance
        }
    }

    subscribe(userId:string,channel:string){
        if(this.subscriptions.get(userId)?.includes(channel)){
            return 
        }
        
        this.subscriptions.set(userId,(this.subscriptions.get(userId) || [])?.concat(channel));
        this.reverseSubscriptions.set(channel,(this.reverseSubscriptions.get(channel) || []).concat(userId));

        if(this.reverseSubscriptions.get(channel)?.length === 1){
            this.rediClient.subscribe(channel, this.redisHandler);
        }
    }

    unsubscribe(userId:string,channel:string) {
        if(!this.reverseSubscriptions.get(channel)?.includes(userId)){
            return 
        }

        this.subscriptions.set(userId,(this.subscriptions.get(userId) || []).filter(x => x != channel));
        this.reverseSubscriptions.set(channel,(this.reverseSubscriptions.get(channel) || []).filter(x => x != userId));

        if(this.reverseSubscriptions.get(channel)?.length === 0){
            this.rediClient.unsubscribe(channel);
        }
    }

    // Just remove the user from all the mapings
    userLeft(userId:string) {

    }


    private redisHandler =   (message:string,channel:string) =>  {
        const userIds = this.reverseSubscriptions.get(channel);

        userIds?.forEach((x:string) => {
            const user = UserManager.getInstance().getUser(x);
            user?.emit(message)
        })
    }

}