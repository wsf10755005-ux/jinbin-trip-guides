# 金賓員工旅遊攻略

兩個獨立的手機版攻略頁，不含員工名單、房號與桌次資料。

- `docs/r01/index.html`：A 方案／R01，福森號、嘉義阿里山、高鐵來回、阿里山賓館。
- `docs/r02/index.html`：B 方案／R02，台中南投兩天一夜、遊覽車、日月潭力麗溫德姆與台中李方艾美住宿介紹。依實際分配入住，不代表兩家各住一晚。

## GitHub Pages

Settings → Pages → Source 選 Deploy from a branch → Branch 選 main、資料夾 /docs → Save。
兩個入口分別為網站網址後加上 `/r01/` 與 `/r02/`。

## 維護

修改 `build.mjs` 的路線文字與連結後，執行 `node build.mjs`，提交 docs 內容。
只修改樣式或聲音時，編輯 `docs/assets/style.css`、`docs/assets/guide.js` 即可。
所有景點、票券與飯店設施以公司及官方最新公告為準，不捏造時程。

## 聲音

使用瀏覽器 Web Audio 即時合成，不載入第三方錄音。
R01 開啟聲音後鳴笛並播放行車聲，每 150 秒再鳴笛。
R02 播放流水與蟲鳴聲景。兩頁可調音量與關閉；分頁隱藏時暫停。
手機／LINE 內建瀏覽器可能要求點擊「開啟旅程聲音」才允許播放。
行前清單保存在各裝置 localStorage，R01、R02 分開。
