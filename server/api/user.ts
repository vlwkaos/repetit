import db from "../db/connection.js";
import { jsonResponse } from "../json.js";

export function getUser(): Response {
  const user = db.prepare("SELECT * FROM users WHERE id = 1").get();
  return jsonResponse(user);
}

export async function updateUser(req: Request): Promise<Response> {
  const body = await req.json();
  const { username, avatar, settings } = body;

  if (username !== undefined) {
    db.prepare("UPDATE users SET username = ? WHERE id = 1").run(username);
  }
  if (avatar !== undefined) {
    db.prepare("UPDATE users SET avatar = ? WHERE id = 1").run(avatar);
  }
  if (settings !== undefined) {
    db.prepare("UPDATE users SET settings = ? WHERE id = 1").run(JSON.stringify(settings));
  }

  const user = db.prepare("SELECT * FROM users WHERE id = 1").get();
  return jsonResponse(user);
}
