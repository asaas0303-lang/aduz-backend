const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function (file) {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('./src');
files.forEach((f) => {
  let content = fs.readFileSync(f, 'utf8');
  content = content.replace(/from '(\.[^']+)'/g, (match, p1) => {
    if (!p1.endsWith('.js')) {
      return `from '${p1}.js'`;
    }
    return match;
  });
  fs.writeFileSync(f, content);
});
