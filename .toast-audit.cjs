const fs = require('fs'), path = require('path'), ts = require('typescript');
for (const root of ['app', 'components']) {
  const visit = (dir) => { for (const item of fs.readdirSync(dir, {withFileTypes:true})) { const file=path.join(dir,item.name); if(item.isDirectory()) visit(file); else if(file.endsWith('.tsx')) scan(file); } };
  visit(root);
}
function scan(file) {
 const src=fs.readFileSync(file,'utf8'), ast=ts.createSourceFile(file,src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const walk=(node,inToast=false)=>{
  if(ts.isJsxElement(node)||ts.isJsxSelfClosingElement(node)) {
   const opening=ts.isJsxElement(node)?node.openingElement:node;
   const tag=opening.tagName.getText(ast); inToast ||= tag==='ToastFeedback';
   const role=opening.attributes.properties.find(a=>ts.isJsxAttribute(a)&&a.name.getText(ast)==='role');
   const value=role?.initializer?.getText(ast);
   if(!inToast && value && /['"](?:alert|status)['"]/.test(value)) {
    const pos=ast.getLineAndCharacterOfPosition(opening.getStart(ast));
    console.log(`${file}:${pos.line+1}: ${opening.getText(ast).slice(0,155)}`);
   }
  }
  ts.forEachChild(node,child=>walk(child,inToast));
 };
 walk(ast);
}
