/** Clipboard permissions vary by browser/context; failure leaves the visible code selectable. */
export async function copyRoomCode(code:string,clipboard:Pick<Clipboard,'writeText'>|undefined):Promise<boolean>{
 try{if(!clipboard?.writeText)return false;await clipboard.writeText(code);return true;}catch{return false;}
}
