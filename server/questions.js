export const SAMPLE=[
  {text:'ดาวเคราะห์ดวงใดอยู่ใกล้ดวงอาทิตย์ที่สุด?',options:['โลก','ดาวพุธ','ดาวศุกร์','ดาวอังคาร'],answer:1},
  {text:'12 × 8 มีค่าเท่ากับเท่าไร?',options:['86','92','96','108'],answer:2},
  {text:'น้ำเปลี่ยนเป็นน้ำแข็งที่อุณหภูมิเท่าใด (ที่ความดันปกติ)?',options:['0°C','10°C','50°C','100°C'],answer:0},
  {text:'พืชใช้แก๊สใดในการสังเคราะห์ด้วยแสง?',options:['ออกซิเจน','ไนโตรเจน','ฮีเลียม','คาร์บอนไดออกไซด์'],answer:3},
  {text:'คำว่า “Survive” มีความหมายว่าอย่างไร?',options:['นอนหลับ','เอาชีวิตรอด','เดินทาง','เรียนรู้'],answer:1},
  {text:'ประเทศไทยมีกี่จังหวัด?',options:['75','76','77','78'],answer:2},
  {text:'รูปสามเหลี่ยมมีผลรวมมุมภายในเท่าใด?',options:['90°','180°','270°','360°'],answer:1},
  {text:'สัตว์ชนิดใดเป็นสัตว์เลี้ยงลูกด้วยนม?',options:['ฉลาม','จระเข้','เพนกวิน','โลมา'],answer:3},
  {text:'1 กิโลเมตรเท่ากับกี่เมตร?',options:['100','500','1,000','10,000'],answer:2},
  {text:'แหล่งพลังงานใดเป็นพลังงานหมุนเวียน?',options:['พลังงานแสงอาทิตย์','ถ่านหิน','น้ำมัน','ก๊าซธรรมชาติ'],answer:0}
];
export function validateQuestions(questions) {
  if(!Array.isArray(questions)||questions.length<1||questions.length>100)throw new Error('ต้องมีคำถาม 1–100 ข้อ');
  return questions.map(q=>{
    if(typeof q.text!=='string'||!q.text.trim()||q.text.length>500||!Array.isArray(q.options)||q.options.length!==4||q.options.some(o=>typeof o!=='string'||!o.trim()||o.length>200)||!Number.isInteger(q.answer)||q.answer<0||q.answer>3)throw new Error('แต่ละข้อควรมีคำถาม ตัวเลือก 4 ข้อ และคำตอบที่ถูกต้อง');
    return {text:q.text.trim(),options:q.options.map(o=>o.trim()),answer:q.answer};
  });
}
