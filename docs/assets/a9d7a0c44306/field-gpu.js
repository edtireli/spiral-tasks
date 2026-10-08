// The original twelve-wave field, evaluated in one GPU point draw.
// Geometry and arrival times are uploaded only when they change.
const vertexSource = `
precision highp float;
attribute vec2 a_position;
attribute float a_arrival;
uniform vec2 u_size;
uniform vec4 u_modes[12];
uniform float u_time, u_front, u_wake, u_dpr, u_gap, u_strength;
uniform vec3 u_tint;
uniform float u_tinted;
varying vec4 v_color;
varying float v_feather;
vec3 ramp(float e) {
  if (u_tinted > .5) {
    return e < .62 ? u_tint * (.22 + e * 1.26)
      : mix(u_tint, vec3(250.), (e - .62) / .38);
  }
  if (e <= .18) return mix(vec3(58.,52.,50.),vec3(96.,68.,56.),e/.18);
  if (e <= .40) return mix(vec3(96.,68.,56.),vec3(152.,88.,66.),(e-.18)/.22);
  if (e <= .62) return mix(vec3(152.,88.,66.),vec3(217.,119.,87.),(e-.40)/.22);
  if (e <= .82) return mix(vec3(217.,119.,87.),vec3(238.,178.,132.),(e-.62)/.20);
  return mix(vec3(238.,178.,132.),vec3(250.,228.,206.),(e-.82)/.18);
}
void main() {
  float f = 0.;
  for (int i=0; i<12; i++) {
    f += cos(dot(u_modes[i].xy, a_position)*.5 - u_modes[i].z*u_time + u_modes[i].w);
  }
  f /= 3.464;
  float swell = mod(u_time*.16,1.8)-.4;
  float p = a_position.x/u_size.x*.5 + (1.-a_position.y/u_size.y)*.5;
  float gate = max(.22, 1.-abs(p-swell)/.32);
  float e = min(1.,pow(max(0.,f*f*gate*1.6*1.45),.72));
  float crest = u_front >= 0. ? max(0.,1.-abs(u_front-a_arrival)/.075) : 0.;
  float radius,alpha;
  vec3 color;
  if (crest > .02) {
    float ce = min(1.,e+crest*.95);
    color = ramp(ce);
    alpha = (.075+.42*ce)*u_strength;
    radius = u_gap*(1.35+.7*ce*ce+crest*2.2)/13.;
  } else {
    float be = floor(e*15.)/15.;
    color = ramp(be);
    alpha = (.055+.30*be)*u_strength;
    radius = u_gap*(1.35+.7*be*be)/13.;
    if ((u_front>=0. && u_front>a_arrival) || (u_front<0. && u_wake>0.)) {
      float blend = u_front>=0. ? 1. : u_wake;
      float grey = dot(color,vec3(.34,.46,.20));
      color = mix(color,vec3(grey),blend);
      alpha *= 1.-.68*blend;
    } else if(e<.035) alpha=0.;
  }
  gl_Position=vec4(a_position/u_size*vec2(2.,-2.)+vec2(-1.,1.),0.,1.);
  gl_PointSize=2.*radius*u_dpr+1.;
  v_feather=1./gl_PointSize;
  v_color=vec4(color/255.,alpha);
}
`;
const fragmentSource = `
precision mediump float;
varying vec4 v_color;
varying float v_feather;
void main() {
  float distance=length(gl_PointCoord-vec2(.5));
  float coverage=1.-smoothstep(.5-2.*v_feather,.5,distance);
  gl_FragColor=vec4(v_color.rgb,v_color.a*coverage);
}
`;
function shader(gl,type,source) {
  const value=gl.createShader(type);
  gl.shaderSource(value,source);gl.compileShader(value);
  if(!gl.getShaderParameter(value,gl.COMPILE_STATUS)) {
    const message=gl.getShaderInfoLog(value);gl.deleteShader(value);throw Error(message);
  }
  return value;
}
export function createGPURenderer(canvas,modes) {
  const gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false,powerPreference:'low-power'});
  if(!gl)return null;
  const vertex=shader(gl,gl.VERTEX_SHADER,vertexSource);
  const fragment=shader(gl,gl.FRAGMENT_SHADER,fragmentSource);
  const program=gl.createProgram();
  gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
  gl.deleteShader(vertex);gl.deleteShader(fragment);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const uniforms=Object.fromEntries(['size','modes','time','front','wake','dpr','gap','strength','tint','tinted'].map(name=>[name,gl.getUniformLocation(program,'u_'+name)]));
  gl.uniform4fv(uniforms.modes,new Float32Array(modes.flatMap(m=>[m.kx,m.ky,m.w,m.ph])));
  const position=gl.createBuffer(),arrival=gl.createBuffer();
  const aPosition=gl.getAttribLocation(program,'a_position'),aArrival=gl.getAttribLocation(program,'a_arrival');
  gl.enableVertexAttribArray(aPosition);gl.enableVertexAttribArray(aArrival);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  let count=0,palette='';
  return {
    resize(field,dpr) {
      count=field.cols*field.rows;
      const points=new Float32Array(count*2);
      for(let row=0;row<field.rows;row++)for(let col=0;col<field.cols;col++) {
        const i=(row*field.cols+col)*2;points[i]=field.ox+col*field.gapCss;points[i+1]=field.oy+row*field.gapCss;
      }
      gl.viewport(0,0,canvas.width,canvas.height);
      gl.bindBuffer(gl.ARRAY_BUFFER,position);gl.bufferData(gl.ARRAY_BUFFER,points,gl.STATIC_DRAW);
      gl.vertexAttribPointer(aPosition,2,gl.FLOAT,false,0,0);
      this.setArrivals(new Float32Array(count).fill(2));
      gl.uniform2f(uniforms.size,field.w,field.h);gl.uniform1f(uniforms.dpr,dpr);gl.uniform1f(uniforms.gap,field.gapCss);
    },
    setArrivals(values) {
      gl.bindBuffer(gl.ARRAY_BUFFER,arrival);gl.bufferData(gl.ARRAY_BUFFER,values,gl.STATIC_DRAW);
      gl.vertexAttribPointer(aArrival,1,gl.FLOAT,false,0,0);
    },
    draw(field,time,front) {
      const signature=`${field.background}/${field.tint}/${field.strength}`;
      if(signature!==palette) {
        palette=signature;
        const hex=field.background.replace('#','');
        const rgb=(hex.length===3?hex.split('').map(c=>c+c).join(''):hex).match(/../g).map(c=>parseInt(c,16)/255);
        gl.clearColor(rgb[0],rgb[1],rgb[2],1);
        gl.uniform1f(uniforms.strength,field.strength);
        gl.uniform1f(uniforms.tinted,field.tint?1:0);
        gl.uniform3fv(uniforms.tint,field.tint||[0,0,0]);
      }
      gl.uniform1f(uniforms.time,time);gl.uniform1f(uniforms.front,front);gl.uniform1f(uniforms.wake,field.wake);
      gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.POINTS,0,count);
    }
  };
}
