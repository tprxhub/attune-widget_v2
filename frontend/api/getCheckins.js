import { google } from "googleapis";

export default async function handler(req, res) {
  const { email } = req.query;

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_KEY),
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: "CheckIns!A:E",
    });

    const rows = result.data.values || [];
    // Filter rows by email (col B = email)
    const filtered = rows.filter((row) => row[1] === email);

    res.status(200).json({ rows: filtered });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch data" });
  }
}
