pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js";

const emailInput = document.getElementById("email");
const submit = document.getElementById("sendEmail");
const errorMsg = document.getElementById("errorMsg");
const emailForm = document.getElementById("emailForm");
const firmaSection = document.getElementById("firmaSection");
const welcomeMsg = document.getElementById("welcomeMsg");
const loadingMsg = document.getElementById("loadingMsg");

const baseurl = "http://34.175.101.232:3000";
let currentUserData = {};

const $firmaCanvas = document.querySelector("#firmaCanvas"),
  $btnLimpiarFirma = document.querySelector("#btnLimpiarFirma"),
  $btnGuardarPDF = document.querySelector("#btnGuardarPDF"),
  $btnPrevisualizarPDF = document.querySelector("#btnPrevisualizarPDF"),
  $nombre = document.querySelector("#nombre"),
  $dni = document.querySelector("#dni"),
  $previewIframe = document.querySelector("#previewIframe");

let pdfDoc = null,
  pageNumber = 1,
  firmaContext = $firmaCanvas.getContext("2d");

submit.addEventListener("click", async () => {
  const email = emailInput.value;
  loadingMsg.style.display = "block";
  errorMsg.style.display = "none";
  welcomeMsg.style.display = "none";
  firmaSection.style.display = "none";

  try {
    const response = await fetch(`${baseurl}/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      errorMsg.textContent = "Correo no encontrado en la base de datos.";
      errorMsg.style.display = "block";
      loadingMsg.style.display = "none";
      return;
    }

    const result = await response.json();
    if (result.message === "Correo recibido correctamente") {
      welcomeMsg.innerText = `Bienvenido, ${email}`;
      welcomeMsg.style.display = "block";
      getUserData();

      const downloadResponse = await fetch(`${baseurl}/download`);

      const contentType = downloadResponse.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const downloadData = await downloadResponse.json();
        if (downloadData.redirectUrl) {
          window.location.href = downloadData.redirectUrl;
          return;
        }
      } else if (downloadResponse.ok) {
        const pdfBlob = await downloadResponse.blob();
        emailForm.style.display = "none";
        firmaSection.style.display = "block";
        const pdfUrl = URL.createObjectURL(pdfBlob);
        loadPdfFromUrl(pdfUrl);
      } else {
        throw new Error("Error al obtener el archivo PDF.");
      }
    } else {
      throw new Error("Correo no encontrado en la base de datos.");
    }
  } catch (error) {
    console.error("Error al procesar la solicitud:", error);
    errorMsg.textContent = "Correo no encontrado en la base de datos.";
    errorMsg.style.display = "block";
  } finally {
    loadingMsg.style.display = "none";
  }
});

// Función para cargar el PDF desde la URL
async function loadPdfFromUrl(url) {
  try {
    const pdfData = await fetch(url).then((res) => res.arrayBuffer());
    pdfDoc = await pdfjsLib.getDocument(pdfData).promise;
    renderPDF();
  } catch (error) {
    console.error("Error al cargar PDF:", error);
  }
}

// Renderizar el PDF en el iframe
async function renderPDF() {
  const pdfPage = await pdfDoc.getPage(pageNumber);
  const viewport = pdfPage.getViewport({ scale: 1 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const context = canvas.getContext("2d");

  await pdfPage.render({ canvasContext: context, viewport: viewport }).promise;
  $previewIframe.src = canvas.toDataURL();
  $previewIframe.style.display = "block";
}

// Función para limpiar el área de firma
$btnLimpiarFirma.onclick = () => {
  firmaContext.clearRect(0, 0, $firmaCanvas.width, $firmaCanvas.height);
};

// Configuración de dibujo en el área de firma
let haComenzadoDibujo = false;
let xActual = 0,
  yActual = 0;

const obtenerXReal = (clientX) =>
  clientX - $firmaCanvas.getBoundingClientRect().left;
const obtenerYReal = (clientY) =>
  clientY - $firmaCanvas.getBoundingClientRect().top;

// Eventos de ratón para firma
$firmaCanvas.addEventListener("mousedown", (e) => {
  xActual = obtenerXReal(e.clientX);
  yActual = obtenerYReal(e.clientY);
  haComenzadoDibujo = true;
});

$firmaCanvas.addEventListener("mousemove", (e) => {
  if (!haComenzadoDibujo) return;
  const xAnterior = xActual;
  const yAnterior = yActual;
  xActual = obtenerXReal(e.clientX);
  yActual = obtenerYReal(e.clientY);

  firmaContext.beginPath();
  firmaContext.moveTo(xAnterior, yAnterior);
  firmaContext.lineTo(xActual, yActual);
  firmaContext.strokeStyle = "black";
  firmaContext.lineWidth = 2;
  firmaContext.stroke();
  firmaContext.closePath();
});

$firmaCanvas.addEventListener("mouseup", () => (haComenzadoDibujo = false));

// Eventos de toque para dispositivos táctiles
$firmaCanvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  xActual = obtenerXReal(touch.clientX);
  yActual = obtenerYReal(touch.clientY);
  haComenzadoDibujo = true;
});

$firmaCanvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  if (!haComenzadoDibujo) return;
  const touch = e.touches[0];
  const xAnterior = xActual;
  const yAnterior = yActual;
  xActual = obtenerXReal(touch.clientX);
  yActual = obtenerYReal(touch.clientY);

  firmaContext.beginPath();
  firmaContext.moveTo(xAnterior, yAnterior);
  firmaContext.lineTo(xActual, yActual);
  firmaContext.strokeStyle = "black";
  firmaContext.lineWidth = 2;
  firmaContext.stroke();
  firmaContext.closePath();
});

$firmaCanvas.addEventListener("touchend", () => (haComenzadoDibujo = false));

async function generarPDFConFirma(previsualizar = false) {
  if (!pdfDoc) {
    alert("Por favor, carga un PDF antes de intentar guardarlo.");
    return;
  }

  const nombre = $nombre.value;
  const dni = $dni.value;

  if (!nombre || !dni) {
    alert("Por favor, ingrese su nombre y DNI.");
    return;
  }

  const pdfPage = await pdfDoc.getPage(pageNumber);
  const viewport = pdfPage.getViewport({ scale: 1 });
  const pdfWidth = viewport.width;
  const pdfHeight = viewport.height;

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = pdfWidth;
  outputCanvas.height = pdfHeight;
  const outputContext = outputCanvas.getContext("2d");

  await pdfPage.render({ canvasContext: outputContext, viewport: viewport })
    .promise;

  const firmaImgData = $firmaCanvas.toDataURL("image/png");
  const firmaImg = new Image();
  firmaImg.src = firmaImgData;
  await firmaImg.decode();

  outputContext.drawImage(firmaImg, 400, pdfHeight - 300, 150, 75);
  outputContext.drawImage(firmaImg, pdfWidth - 220, pdfHeight - 550, 150, 75);

  const date = new Date();
  const formattedDate = `${date.getDate()}-${
    date.getMonth() + 1
  }-${date.getFullYear()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;

  outputContext.font = "12px Arial";
  outputContext.fillStyle = "black";
  outputContext.fillText(` ${nombre}`, 120, pdfHeight - 625);
  outputContext.fillText(` ${dni}`, 450, pdfHeight - 625);
  outputContext.fillText(` ${nombre}`, pdfWidth - 500, pdfHeight - 260);
  outputContext.fillText(` ${dni}`, pdfWidth - 320, pdfHeight - 260);

  outputContext.font = "8px Arial";
  outputContext.fillStyle = "gray";
  outputContext.fillText(` ${formattedDate}`, 370, pdfHeight - 270);
  outputContext.fillText(` ${dni}`, 370, pdfHeight - 260);
  outputContext.fillText(` ${nombre}`, 370, pdfHeight - 250);

  outputContext.font = "8px Arial";
  outputContext.fillStyle = "gray";
  outputContext.fillText(` ${formattedDate}`, 370, pdfHeight - 520);
  outputContext.fillText(` ${dni}`, 370, pdfHeight - 510);
  outputContext.fillText(` ${nombre}`, 370, pdfHeight - 500);

  const imgDataUrl = outputCanvas.toDataURL("image/png");
  const imgBytes = await fetch(imgDataUrl).then((res) => res.arrayBuffer());

  const pdfLibDoc = await PDFLib.PDFDocument.create();
  const pdfLibPage = pdfLibDoc.addPage([pdfWidth, pdfHeight]);
  const pngImage = await pdfLibDoc.embedPng(imgBytes);
  pdfLibPage.drawImage(pngImage, {
    x: 0,
    y: 0,
    width: pdfWidth,
    height: pdfHeight,
  });

  const pdfBytes = await pdfLibDoc.save();
  const blob = new Blob([pdfBytes], { type: "application/pdf" });

  if (previsualizar) {
    // Verificar si el usuario está en móvil para abrir el PDF en nueva pestaña
    const isMobile = window.matchMedia(
      "only screen and (max-width: 768px)"
    ).matches;

    if (isMobile) {
      const pdfUrl = URL.createObjectURL(blob);
      window.open(pdfUrl, "_blank"); // Abre el PDF en una nueva pestaña en móvil
    } else {
      $previewIframe.src = URL.createObjectURL(blob); // Muestra en iframe en escritorio
      $previewIframe.style.display = "block";
    }
  } else {
    enviarPDF(blob); // Enviar el PDF por correo
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `documento-firmado-${nombre}-${dni}-${currentUserData.urlRecibiDiploma}-${currentUserData.Curso}}.pdf`;
    link.click();
  }
}

async function eliminarUsuario() {
  const email = emailInput.value;
  const response = await fetch(`${baseurl}/delete`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  if (response.ok) {
    const result = await response.json();
    if (result.message === "Usuario eliminado correctamente") {
      console.log("Usuario eliminado correctamente");
    }
  }
}

// Enviar el PDF por correo
const enviarPDF = async (pdfBlob) => {
  const formData = new FormData();
  formData.append("pdf", pdfBlob);
  formData.append("email", emailInput.value);
  formData.append("nombre", $nombre.value);
  formData.append("dni", $dni.value);
  formData.append("urlRecibiDiploma", currentUserData.urlRecibiDiploma);
  formData.append("Curso", currentUserData.Curso);

  const response = await fetch(`${baseurl}/send-signed-pdf`, {
    method: "POST",
    body: formData,
  });

  if (response.ok) {
    const result = await response.json();
    if (result.message === "Correo enviado correctamente") {
      alert("PDF firmado enviado correctamente por correo electrónico.");
    }
  }
  eliminarUsuario();
};

async function getUserData() {
  const response = await fetch(`${baseurl}/get-user-data`);
  if (response.ok) {
    const result = await response.json();
    currentUserData = result;
    console.log("Datos del usuario:", currentUserData);
    console.log(currentUserData.urlRecibiDiploma);
    localStorage.setItem("userData", JSON.stringify(result));
  }
}

$btnPrevisualizarPDF.addEventListener("click", () => {
  generarPDFConFirma(true);
});

$btnGuardarPDF.addEventListener("click", () => {
  generarPDFConFirma(false);
});
