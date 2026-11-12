const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const names = new Set(['message', 'error', 'notice', 'success', 'formError', 'loadError', 'saveError', 'toast']);
const files = [];
for (const root of ['app', 'components']) {
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const name = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(name);
      else if (name.endsWith('.tsx')) files.push(name);
    }
  };
  visit(root);
}
let total = 0;
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const matches = [];
  const walk = (node) => {
    if (ts.isJsxExpression(node) && node.expression && ts.isBinaryExpression(node.expression)) {
      let binary = node.expression;
      const conditions = [];
      while (ts.isBinaryExpression(binary) && binary.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
        conditions.push(binary.left.getText(ast));
        binary = binary.right;
      }
      while (ts.isParenthesizedExpression(binary)) binary = binary.expression;
      if ((ts.isJsxElement(binary) || ts.isJsxSelfClosingElement(binary) || ts.isJsxFragment(binary)) && conditions.some((condition) => names.has(condition))) {
        matches.push({ start: binary.getStart(ast), end: binary.getEnd(), condition: conditions.find((condition) => names.has(condition)) });
      }
    }
    ts.forEachChild(node, walk);
  };
  walk(ast);
  if (!matches.length) continue;
  console.log(file, matches.length);
  total += matches.length;
  if (process.argv.includes('--write')) {
    let output = source;
    for (const match of matches.sort((a, b) => b.start - a.start)) {
      const jsx = output.slice(match.start, match.end);
      const tone = /(?:text|border|bg)-red-/.test(jsx) || match.condition === 'error' || match.condition === 'formError' ? 'error' : /(?:text|border|bg)-amber-/.test(jsx) ? 'warning' : /(?:text|border|bg)-(?:emerald|green)-/.test(jsx) || match.condition === 'notice' || match.condition === 'success' ? 'success' : 'info';
      output = output.slice(0, match.start) + `<ToastFeedback message={String(${match.condition})} tone="${tone}">${jsx}</ToastFeedback>` + output.slice(match.end);
    }
    const importLine = `import { ToastFeedback } from '@/components/toast-feedback';\n`;
    const directive = /^(\s*['"]use client['"];?\s*\r?\n)/.exec(output);
    output = directive ? output.slice(0, directive[0].length) + importLine + output.slice(directive[0].length) : importLine + output;
    fs.writeFileSync(file, output);
  }
}
console.log('TOTAL', total);
