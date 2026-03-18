import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import pkg from 'pg';
const { Pool } = pkg;
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const JWT_SECRET = process.env.JWT_SECRET || "finmo-secret-key";

// Initialize database
const initDb = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        picture TEXT
      )
    `);
    console.log("Database initialized successfully");
  } catch (err) {
    console.error("Error initializing database:", err);
  }
};

initDb();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  // Auth API
  app.post("/api/auth/signup", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Nome de usuário e senha são obrigatórios" });
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await pool.query(
        "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id",
        [username, hashedPassword]
      );
      
      const userId = result.rows[0].id;
      const token = jwt.sign({ id: userId, username }, JWT_SECRET);
      res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "none" });
      res.json({ user: { id: userId, username } });
    } catch (error: any) {
      if (error.code === "23505") { // PostgreSQL unique violation code
        res.status(400).json({ error: "Este nome de usuário já está em uso" });
      } else {
        console.error("Signup error:", error);
        res.status(500).json({ error: "Erro ao criar conta" });
      }
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    try {
      const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
      const user = result.rows[0];

      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: "Usuário ou senha inválidos" });
      }

      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
      res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "none" });
      res.json({ user: { id: user.id, username: user.username } });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Erro ao fazer login" });
    }
  });

  app.get("/api/auth/me", (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Não autenticado" });

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      res.json({ user: { id: decoded.id, username: decoded.username } });
    } catch {
      res.status(401).json({ error: "Token inválido" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("token");
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
