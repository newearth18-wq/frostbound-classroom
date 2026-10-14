export class QRScanner {
  constructor(id){this.container=document.getElementById(id);this.running=false;this.stream=null;this.timer=null;this.canvas=document.createElement('canvas');this.context=this.canvas.getContext('2d',{willReadFrequently:true});}
  decode(source,width,height){
    const scale=Math.min(1,1400/Math.max(width,height));this.canvas.width=Math.round(width*scale);this.canvas.height=Math.round(height*scale);
    this.context.drawImage(source,0,0,this.canvas.width,this.canvas.height);
    const image=this.context.getImageData(0,0,this.canvas.width,this.canvas.height);
    return window.jsQR(image.data,image.width,image.height,{inversionAttempts:'attemptBoth'})?.data;
  }
  async scanFile(file){
    await this.stop();const image=await createImageBitmap(file);
    try{const text=this.decode(image,image.width,image.height);if(!text)throw Error('ไม่พบ QR Code ในรูป');return text;}finally{image.close();}
  }
  async start(onDecode){
    this.running=true;
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:960},height:{ideal:720}},audio:false});
      if(!this.running){stream.getTracks().forEach(t=>t.stop());return;}
      this.stream=stream;this.video=document.createElement('video');this.video.setAttribute('playsinline','');this.video.muted=true;this.video.style.width='100%';this.container.appendChild(this.video);this.video.srcObject=stream;await this.video.play();
      const frame=async()=>{
        if(!this.running)return;
        if(this.video.readyState>=2&&this.video.videoWidth){const code=this.decode(this.video,this.video.videoWidth,this.video.videoHeight);if(code){await onDecode(code);if(!this.running)return;}}
        this.timer=setTimeout(frame,140);
      };frame();
    }catch(e){await this.stop();throw e;}
  }
  async stop(){this.running=false;clearTimeout(this.timer);this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.video?.remove();this.video=null;}
  async clear(){await this.stop();this.canvas.width=0;this.canvas.height=0;}
  get isScanning(){return this.running;}
}
