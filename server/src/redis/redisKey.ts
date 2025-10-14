

export const redisProfileKey=(userId:string)=>{
    return `user:${userId}`
}
export const redisGroupKey=(userId:string)=>{
    return `group:${userId}`
}