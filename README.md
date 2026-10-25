# Campus Code Camp: validated registration form

## Run it
```
npm install
npm start
```
Open http://localhost:3000

## What to show in the video
1. Submit valid data: green toast, button shows spinner and is disabled.
2. Submit empty or bad data: red inline messages per field (client layer).
3. Tick "Demo: skip browser validation", submit bad data again: the server
   rejects it and the same field errors appear (server layer).
4. Optional: `curl -X POST http://localhost:3000/api/register -F fullName=1`
   shows the server returns 422 even with no frontend at all.
