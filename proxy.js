import express from "express";
import mysql from "mysql2";
import cors from "cors";
import fetch from "node-fetch";
import multer from "multer";
import nodemailer from "nodemailer";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const PORT = 3000;
let correo = "";

// Conexión a MySQL
const connection = mysql.createConnection({
  host: "34.175.215.166",
  user: "admin",
  password: "1234",
  database: "usuarios",
  charset: "utf8_general_ci", // Configura un charset estándar
});

connection.connect((err) => {
  if (err) {
    console.error("Error al conectar a la base de datos MySQL:", err);
    return;
  }
  console.log("Conexión exitosa a la base de datos MySQL");
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "certificadosturiscool@gmail.com",
    pass: "rlaf aytu eswa ocgu",
  },
});

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.post("/send-signed-pdf", upload.single("pdf"), async (req, res) => {
  const actualyear = new Date().getFullYear();
  const pdfBuffer = req.file?.buffer;
  const nombre = req.body.nombre;
  const dni = req.body.dni;
  const urlRecibiDiploma = req.body.urlRecibiDiploma;
  const Curso = req.body.Curso;

  if (!pdfBuffer) {
    return res.status(400).json({ message: "Email o archivo PDF faltante" });
  }

  try {
    const mailOptions = {
      from: "certificadosturiscool@gmail.com",
      to: "certificadosturiscool@gmail.com",
      subject: `Diploma Fundae firmado ${nombre} ${dni} ${urlRecibiDiploma} ${Curso} ${actualyear}.pdf`,
      text: `Adjunto se encuentra el diploma FUNDAE del alumno ${nombre}`,
      attachments: [
        {
          filename: `Diploma Fundae-${nombre}-${dni}-${urlRecibiDiploma}-${Curso}/${actualyear}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Correo enviado correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al enviar el correo" });
  }
});

app.post("/send-email", (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email no proporcionado" });
  }

  correo = email;
  console.log("Correo recibido:", email);
  res.status(200).json({ message: "Correo recibido correctamente" });
});

app.get("/get-user-data", (req, res) => {
  connection.query(
    `SELECT * FROM usuarios WHERE correo = ?`,
    [correo],
    (err, result) => {
      if (err) {
        console.error("Error consultando MySQL:", err.message);
        return res.status(500).send("Error en la consulta a la base de datos");
      }

      if (result.length === 0) {
        console.error("Correo no encontrado en la base de datos");
        return res.status(404).send("Correo no encontrado en la base de datos");
      }

      res.status(200).json(result[0]);
    }
  );
});

app.get("/download", async (req, res) => {
  if (!correo) {
    return res.status(400).send("Correo no proporcionado");
  }

  connection.query(
    `SELECT link FROM usuarios WHERE correo = ?`,
    [correo],
    async (err, result) => {
      if (err) {
        console.error("Error consultando MySQL:", err.message);
        return res.status(500).send("Error en la consulta a la base de datos");
      }

      if (result.length === 0) {
        console.error("Correo no encontrado en la base de datos");
        return res.status(404).send("Correo no encontrado en la base de datos");
      }

      const link = result[0].link;
      if (link.includes("firmafy")) {
        // Redirigir a la URL de Firmafy
        return res.json({ redirectUrl: link });
      } else if (link.includes("google")) {
        // Descargar y enviar PDF desde Google Drive
        const previewUrlParts = link.split("/");
        const fileId = previewUrlParts[previewUrlParts.length - 2];
        const driveUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

        try {
          const response = await fetch(driveUrl);
          if (!response.ok) {
            throw new Error("Hubo un problema al descargar el archivo.");
          }

          res.set("Access-Control-Allow-Origin", "*");
          res.set("Content-Type", "application/pdf");
          res.set("Content-Disposition", "inline; filename=archivo.pdf");

          response.body.pipe(res);
        } catch (error) {
          console.error(
            "Error descargando o transmitiendo el PDF:",
            error.message
          );
          res
            .status(500)
            .send("Error al descargar o transmitir el archivo PDF");
        }
      } else {
        res.status(400).send("Tipo de enlace no soportado");
      }
    }
  );
});

//eliminar el usuario de la base de datos despues de haber descargado el pdf
app.delete("/delete", (req, res) => {
  connection.query(
    `DELETE FROM usuarios WHERE correo = ?`,
    [correo],
    (err, result) => {
      if (err) {
        console.error("Error eliminando usuario de la base de datos:", err);
        return res
          .status(500)
          .send("Error eliminando usuario de la base de datos");
      }

      console.log("Usuario eliminado de la base de datos");
      res.status(200).send("Usuario eliminado de la base de datos");
    }
  );
});

const server = app.listen(PORT, () => {
  console.log(`Servidor proxy ejecutándose en ${PORT}`);
});

export { app, server };
