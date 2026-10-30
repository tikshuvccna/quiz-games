# תוסף Chrome: ייבוא חידונים מ־Kahoot לפיצוץ מוחות

התוסף שומר חידונים של Kahoot (עם התמונות, סוגי השאלות, הסרטונים והמידע על החידון) וקובץ אחד שאפשר לייבא לפיצוץ מוחות בלחיצה, או שולח אותם ישר לתוכנה שרצה אצלכם.

## התקנה (פעם אחת, 30 שניות)

1. בדפדפן Chrome (או Edge) פתחו את הכתובת `chrome://extensions` (ב־Edge: `edge://extensions`).
2. הפעילו **מצב מפתח** (Developer mode) בפינה.
3. לחצו **טעינת תוסף שלא ארוז** (Load unpacked) ובחרו את התיקייה `extension` שבתוך תיקיית התוכנה.
4. מומלץ לנעוץ את התוסף בסרגל הכלים (סמל הפאזל ← סיכה ליד "ייבוא מ־Kahoot").

התוסף לא נמצא בחנות של Chrome. הוא מותקן מהתיקייה הזו, ועובד כל עוד התיקייה קיימת. אחרי עדכון של התוכנה אפשר ללחוץ ↻ בעמוד התוספים.

## שימוש

לחצו על הסמל ★ בסרגל הכלים. נפתחת לשונית עם שני אופנים:

- **📄 בדף הפתוח**: פתחו באתר Kahoot חידון (דף הפרטים שלו), או דף עם רשימת חידונים (תוצאות חיפוש, האוספים שלכם). התוסף מוצא את כל החידונים בדף. גללו בדף של Kahoot כדי שיטענו עוד חידונים, ולחצו "סריקה מחדש".
- **🔎 חיפוש**: חפשו חידונים ישירות מהתוסף (עברית או אנגלית), סמנו כמה שרוצים, גם מכמה חיפושים, וטענו עוד תוצאות.

אחרי הסימון:

- **⬇ שמירה כקובץ**: נשמר קובץ `kahoot-export-….zip`. בעורך החידונים של פיצוץ מוחות לחצו **⬆ ייבוא קובץ** ובחרו אותו.
- **📤 שליחה לתוכנה**: שולח ישר לתוכנה. פתחו את "⚙ כתובת התוכנה" וכתבו את הכתובת של המחשב שמריץ את פיצוץ מוחות (למשל `localhost:3000` באותו מחשב, או הכתובת שמופיעה במסך המורה). בפעם הראשונה Chrome יבקש אישור גישה לכתובת הזו.

חידון אחד נוסף לספרייה כחידון. כמה חידונים נכנסים לתיקייה חדשה בשם Kahoot. אפשר לייצא עד 100 בבת אחת.

## מה מיובא

כל סוגי השאלות של Kahoot: חידון, נכון/לא נכון, בחירה מרובה, הקלדת תשובה, סידור, סרגל, סימון על תמונה (כולל אזורים עגולים ומצולעים), סיכה חופשית, סקר (גם מרובה), ענן מילים, תשובה פתוחה, סיעור מוחות ושקופיות. התמונות (של השאלות ושל התשובות), סרטוני יוטיוב, ניקוד כפול וזמנים מיובאים. שם היוצר והקישור המקורי נשמרים בחידון.

לא מיובאים: סרטונים שהועלו ל־Kahoot עצמו, חיתוך תמונות שנעשה על המסך, מוזיקה ועיצובים. מה שדולג או הוחלף מופיע בדוח הייבוא שנפתח בעורך.

## מגבלות ושימוש הוגן

- רק **חידונים ציבוריים**, או חידונים שלכם כשאתם מחוברים ל־Kahoot באותו דפדפן. חידון פרטי של מישהו אחר לא יורד.
- החידונים שייכים ליוצרים שלהם, ובתנאי השימוש של Kahoot אין היתר להעתקה המונית. השתמשו בתוסף לשימוש הכיתתי שלכם, ושמרו על שם היוצר שמצורף לחידון. התוסף מוריד לאט ובכמות מוגבלת בכוונה.
- הפורמט של Kahoot אינו רשמי ויכול להשתנות. אם משהו מפסיק לעבוד, התיקון נעשה בתוכנה (בקובץ `server/importers/kahoot.js`) ולא בתוסף.

## פרטיות

התוסף מדבר רק עם שני מקומות: האתר של Kahoot (כדי להוריד את החידונים שבחרתם) והתוכנה שלכם (אם בחרתם "שליחה"). הוא לא אוסף מידע, לא שולח אותו לאף שרת אחר ולא טוען קוד מבחוץ.

## קבצים

| קובץ | תפקיד |
|---|---|
| `manifest.json` | הגדרות התוסף (Manifest V3) והרשאות: Kahoot, ומחשב התוכנה שלכם בלבד |
| `app.html`, `app.js`, `app.css` | הלשונית: סריקת הדף, חיפוש, בחירה, שמירה ושליחה |
| `lib/kahoot-api.js` | חיפוש והורדה מ־Kahoot ובניית קובץ הייצוא (נבדק גם ב־Node, `scripts/extension-test.js`) |
| `lib/jszip.min.js` | ספריית zip (JSZip 3.10.2, רישיון MIT) |
| `background.js` | פותח את הלשונית בלחיצה על הסמל |

הסמלים נוצרים ב־`node scripts/make-extension-icons.js`.

---

## English

A Chrome/Edge extension that saves Kahoot quizzes (with pictures, question types, videos and quiz info) as one zip the BrainBlast editor imports with **⬆ ייבוא קובץ**, or sends them straight to your running program.

**Install:** open `chrome://extensions`, turn on *Developer mode*, choose *Load unpacked* and pick this `extension` folder. Click the ★ icon: **📄 On this page** finds the quizzes on an open Kahoot page; **🔎 Search** searches Kahoot's public quizzes. Tick quizzes, then **⬇ Save as file** or **📤 Send to the program** (enter the program's address under ⚙; Chrome asks once for access to that address).

Public quizzes only (or your own, while logged in to Kahoot in the same browser). Quizzes belong to their authors and Kahoot's terms do not allow mass copying: use it for your own classroom, keep the author credit that is saved with each quiz. Kahoot's format is unofficial; the conversion lives in `server/importers/kahoot.js`, so a change on Kahoot's side is fixed there. The extension talks only to Kahoot and to your own program.
