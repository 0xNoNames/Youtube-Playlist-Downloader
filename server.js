"use strict";
const express = require("express");
const app = express();
const httpServer = require("http").createServer(app);
const cors = require("cors");

const io = require("socket.io")(httpServer);

const fs = require("fs");

const youtube_info = require("ytdl-core");
const youtube_playlist = require("ytpl");
const youtube_downloader_audio = require("youtube-mp3-downloader");
const youtube_downloader_image = require("image-downloader");
const youtube_validator = require("youtube-validate");

const downloader_audio = new youtube_downloader_audio({
  ffmpegPath: "C:/ffmpeg/bin/ffmpeg.exe",
  youtubeVideoQuality: "highestaudio",
});

/////////////////////////////////////////////////

app.use(cors());

app.use(express.static("public"));

httpServer.listen(8003, () => {
  console.log("Serveur en écoute sur le port 8003");
});

/////////////////////////////////////////////////

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

/////////////////////////////////////////////////

io.on("connection", (socket) => {
  socket.on("disconnect", function () {
    console.log(socket + " disconnected.");
    fs.rmdirSync(`private/${socket.id}`, { recursive: true });
    // delete all files.
  });

  socket.on("url", (msg) => {
    let url = decodeURI(encodeURI(msg));

    console.log(url);

    if (url.includes("playlist")) {
      youtube_playlist(url)
        .then((data) => {
          socket.emit(
            "info",
            "Il y a " + data.estimatedItemCount + " musiques."
          );
          data.items.forEach((video) => {
            if (video.durationSec <= 600) telechargerFichier(id, res);
            else {
              socket.emit("erreur", "Vidéo trop longue, max 10mn.");
              console.error("Vidéo trop longue");
            }
          });
        })
        .catch((err) => {
          socket.emit(
            "erreur",
            "Mauvais lien frérot (playlist ou vidéo youtube seulement)."
          );

          console.error("marche pas" + err);
        });

      // Si l'url est une vidéo.
    } else {
      youtube_validator
        .validateUrl(url)
        .then((id) => {
          // Si la vidéo vient d'une playlist, on enlève les caractères en trop de l'id.
          if (id.includes("&")) id = id.slice(0, id.indexOf("&"));

          socket.emit("info", "Il n'y a qu'une seule musique.");

          youtube_info.getBasicInfo(id).then((data) => {
            if (data.videoDetails.lengthSeconds <= 600) {
              telechargerFichier(id, socket);
            } else {
              socket.emit("erreur", "Vidéo trop longue, max 10mn.");
              console.error("Vidéo trop longue");
            }
          });
        })
        .catch((err) => {
          socket.emit(
            "erreur",
            "Mauvais lien frérot (playlist ou vidéo youtube seulement)."
          );
          console.error("marche pas : " + err);
        });
    }
  });
});

function telechargerFichier(id, socket) {
  fs.mkdirSync(`private/${socket.id}`, { recursive: true });
  downloader_audio.outputPath = `private/${socket.id}`;

  // Télécharge le thumbnail.
  let image_options = {
    url: "https://img.youtube.com/vi/" + id + "/hqdefault.jpg",
    dest: "private/" + socket.id + "/" + id + ".jpg",
  };
  youtube_downloader_image
    .image(image_options)
    .then(({ filename }) => {
      console.log("Image sauvegardée : ", filename);
    })
    .catch((err) => console.error(err));

  // Télécharge la vidéo.
  downloader_audio.download(id);

  // Data contient les infos sur le fichier téléchargé et envoie les infos au client.
  downloader_audio.on("finished", (err, data) => {
    socket.emit("titre", data.videoTitle);

    // var data = fs.readFileSync("private/" + id + ".jpg");
    // var img = Buffer.from(data).toString("base64");

    // socket.emit("miniature", "data:image/png;base64," + img);

    console.log("finished : ", data.videoTitle);
  });

  downloader_audio.on("progress", (err, data) => {
    console.log(data);
    console.log(err);
  });

  // Si erreurs.
  downloader_audio.on("error", (err) => {
    socket.emit("erreur", "Problèmes avec le téléchargement de la vidéo.");
    console.error("Problèmes avec le téléchargement : " + err);
  });
}

app.get("/telecharger", (req, res) => res.download("./file.pdf"));
