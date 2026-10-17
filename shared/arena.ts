/** The same geometry drives server collision and client scenery. */
export const platforms:[number,number,number,number,number][]=[[0,0,0,24,24],[-19,3,-10,10,12],[18,5,-13,12,10],[0,8,-29,14,10],[-17,10,-32,8,8],[21,12,-33,9,9],[0,15,-48,18,12],[28,2,8,10,10],[-27,5,12,10,10]];
export const obstacles:[number,number,number,number,number,number][]=[[7,1.5,-6,3,3,2.5],[-7,2,-6,3,4,2.5],[9,1.5,7,7,3,2.5],[17,7,-15,3,3,2.5],[-19,5,-12,3,3,2.5],[3,17,-49,3,3,2.5]];
export function spawn(index:number){return {x:[-5,5,-2,2,-6,6,-2,2][index%8],y:1,z:index<4?3:-2};}
