CRYPTO WHITE PAPER LIBRARY
88 crypto white papers, yellow papers and protocol specs. 64 PDFs and 7 web-format papers are bundled for offline reading.

ON A COMPUTER (Mac, Windows, Linux)
1. Unzip the file.
2. Open the folder "crypto-library-app" and double-click index.html.
   It opens in your browser and works with no internet connection.
3. Tap a cover to see its details. "Read" opens the bundled copy in the built-in reader.
   If your browser shows a blank reader, use "Open in new tab" at the top right.
   Papers without an offline copy show "Open paper", which goes to the official site (needs internet).
Reading Now and Want to Read are saved in this browser.

ON A PHONE (iPhone / Android)
Phones can't run a web app straight from a zip file. Best option: host the
"crypto-library-app" folder at any static web address (GitHub Pages, Netlify Drop, Cloudflare Pages),
open it in Safari or Chrome, then:
  - iPhone: Share > Add to Home Screen
  - Android: menu > Install app / Add to Home screen
Then tap "Save every paper for offline use" at the bottom of the library to keep all the papers on the phone.
Without hosting, you can still open the PDFs in the "library" folder with the Files app (iPhone) or a file manager (Android).

COMMUNITY UPLOADS
"+ Upload white paper" shares a PDF on the public Community shelf (needs internet; max 25 MB, 5 uploads
per hour). Uploads are public and can be reported; the owner removes bad ones. "Only on this device"
keeps a private copy in My Uploads instead. The Community list is cached for offline use and papers
you open are saved for offline reading. Configure the backend in config.js (public URL + anon key only).

CONTENTS
index.html, app.js, styles.css, data.js   the app
library/                                  bundled PDFs by shelf, offline web-format papers in docs/, catalog.json
config.js                                 Community backend URL + public anon key
pdfjs/                                    Mozilla PDF.js reader (Apache-2.0)
manifest.json, sw.js, icons/              install-as-app (PWA) support when hosted
