/** Match the delta clamp used by Rapier variable-step simulation. */
export const simulationDelta=(dt:number)=>Math.min(Math.max(dt,0),.5);
/** Exponential response is independent of frame rate. Gravity is applied by Rapier.
 * Air braking stays firm, while vertical thrust approaches its target smoothly.
 */
export function nextVelocity(
 velocity:{x:number;y:number;z:number},desired:{x:number;z:number},
 flying:boolean,boost:boolean,dt:number,
){
 const response=1-Math.exp(-10*dt);
 // Rapier subtracts 20 * dt gravity; compensate while smoothly approaching ascent.
 const target=boost?13:8;
 const vertical=velocity.y+(target-velocity.y)*(1-Math.exp(-4*dt))+20*dt;
 return {x:velocity.x+(desired.x-velocity.x)*response,z:velocity.z+(desired.z-velocity.z)*response,
 y:flying?Math.min(target+20*dt,vertical):velocity.y};
}

export const MAX_FUEL = 100;
export function fuelStep(fuel: number, thrust: boolean, boost: boolean, dt: number) {
  return Math.max(0, Math.min(MAX_FUEL, fuel + (thrust ? -(boost ? 38 : 23) : 19) * dt));
}
export function movement(x: number, z: number, yaw: number, speed: number) {
  const length = Math.hypot(x, z) || 1;
  return { x: (x * Math.cos(yaw) + z * Math.sin(yaw)) / length * speed,
    z: (-x * Math.sin(yaw) + z * Math.cos(yaw)) / length * speed };
}
export function recoveryHealth(health: number) { return Math.max(0, health - 25); }
