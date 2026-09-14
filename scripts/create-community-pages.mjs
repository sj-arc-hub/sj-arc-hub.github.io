import { writeFile } from 'node:fs/promises';
const pages=[['SJ-ARC-Team.dc.html','team','운영진 & 지도교수'],['SJ-ARC-Levels.dc.html','levels','레벨 현황'],['SJ-ARC-Gallery.dc.html','gallery','활동 갤러리'],['SJ-ARC-Board.dc.html','board','게시판 · 승급자료'],['manage.html','manage','홈페이지 콘텐츠 관리']];
for(const [filename,page,title] of pages) await writeFile(filename,`<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · SJ-ARC</title>
<meta name="description" content="SJ-ARC 세종사이버대학교 드론 제작·운영 동아리의 ${title}">
${page==='manage'?'<meta name="robots" content="noindex">':''}<link rel="stylesheet" href="./community.css"><script type="module" src="./${page==='manage'?'manage':'community'}.js"></script></head>
<body data-page="${page}"><header id="nav" class="header"><a class="brand" href="./SJ-ARC-Home.dc.html">SJ-ARC</a></header><main><div id="notice" class="status notice" role="status" aria-live="polite">불러오는 중입니다.</div><div id="view"></div><noscript>이 페이지를 보려면 JavaScript를 활성화해 주세요.</noscript></main><dialog id="dialog" aria-label="내용 편집"></dialog><footer>SJ-ARC · 세종사이버대학교 드론 제작·운영 동아리</footer></body></html>
`);
console.log('Updated',pages.length,'community pages');
