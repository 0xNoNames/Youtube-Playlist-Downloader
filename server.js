"use strict";

// -- -- -- -- -- -- -- -- --  IMPORTS  -- -- -- -- -- -- -- -- -- \\

const express = require("express");
const app = express();
const httpServer = require("http").createServer(app);
const io = require("socket.io")(httpServer);
const cors = require("cors");

const fs = require("fs");

const archiver = require("archiver");

const youtube_info = require("ytdl-core");
const youtube_playlist = require("ytpl");
const downloader_image = require("image-downloader");
const mp3_dl = require("youtube-mp3-downloader");
const downloader_audio = new mp3_dl({
  ffmpegPath: "/usr/local/Cellar/ffmpeg/4.4_2/bin/ffmpeg",
  youtubeVideoQuality: "highestaudio",
  "progressTimeout": 250,
  "queueParallelism": 10
});

// -- -- -- -- -- -- -- -- --  DEMARRAGE SERVEUR  -- -- -- -- -- -- -- -- -- \\

app.use(cors());

app.use(express.static("public"));

httpServer.listen(8003, () => {
  console.log("Serveur en écoute sur le port 8003");
});

// -- -- -- -- -- -- -- -- --  ROUTING  -- -- -- -- -- -- -- -- -- \\

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// -- -- -- -- -- -- -- -- --  SOCKETS  -- -- -- -- -- -- -- -- -- \\

io.on("connection", (socket) => {
  socket.ready = true;
  socket.on("disconnect", function () {
    console.log(socket.id + " disconnected.");
    if (fs.existsSync(`private/${socket.id}`))
      fs.rmSync(`private/${socket.id}`, { recursive: true });
    if (fs.existsSync(`private/${socket.id}.zip`, { recursive: true }))
      fs.rmSync(`private/${req.query.id}.zip`, { recursive: true });
  });

  socket.on("url", (msg) => {
    let url = decodeURI(encodeURI(msg));

    if (youtube_info.validateURL(url)) {
      var id = youtube_info.getURLVideoID(url)

      socket.emit("gif-on");

      youtube_info.getBasicInfo(id).then((data) => {
        if (data.videoDetails.lengthSeconds <= 600)
          telechargerFichier(id, data.videoDetails.title, socket);
        else {
          socket.emit("erreur", "Vidéo trop longue, max 10mn");
          console.error("Vidéo trop longue");
          socket.emit("gif-off");
        }
      });
    } else if (url.includes("playlist")) {
      const tes = youtube_playlist(url);
      tes.then((data) => {
        socket.emit("gif-on");
        data.items.forEach((video) => {
          if (video.durationSec <= 600)
            telechargerFichier(video.id, video.title, socket);
          else {
            socket.emit("erreur", "Vidéo trop longue, max 10mn");
            console.error("Vidéo trop longue");
            socket.emit("gif-off");
          }
        });
      }, () => {
        socket.emit("erreur", "Playlist privée ou n'existant pas");
        console.error("Playlist privée");
      })
    } else {
      socket.emit("erreur", "Mauvais lien");
      console.error("Mauvais lien");
    }
  });

  app.get('/telecharger', async (req, res) => {
    try {
      let filename = __dirname + "/private/" + req.query.id + ".zip";

      res.download(filename, "arthurdev.zip", (err) => {
        if (err)
          console.log(err);
        if (fs.existsSync(`private/${req.query.id}`)) {
          fs.rmSync(`private/${req.query.id}`, { recursive: true });
          fs.rmSync(`private/${req.query.id}.zip`, { recursive: true });
        }
        socket.ready = true;
      });
    } catch (err) {
      console.error(err);
    }
  });
});

// -- -- -- -- -- -- -- -- --  FONCTIONS  -- -- -- -- -- -- -- -- -- \\

// Fonction permettant de télécharger un fichier.
const telechargerFichier = (id, title, socket) => {
  if (!fs.existsSync(`private/${socket.id}/`))
    fs.mkdirSync(`private/${socket.id}/`);
  downloader_audio.outputPath = `private/${socket.id}`;

  // Télécharge la vidéo.
  downloader_audio.download(id);

  // Télécharge le thumbnail.
  let image_options = {
    url: "https://img.youtube.com/vi/" + id + "/hqdefault.jpg",
    dest: "private/" + socket.id + "/" + title + ".jpg",
  };
  downloader_image.image(image_options).then(({ filename }) => {
    console.log("Image sauvegardée : ", filename);
  })
    .catch((err) => console.error(err));

  // Changement de la taille de la queue.
  downloader_audio.on("queueSize", (size) => {
    socket.emit("info", `Musiques restantes : ${size}`)

    if (size == 0 && socket.ready) {
      socket.ready = false;
      socket.emit("gif-off");

      let folder = "private/" + socket.id;

      zipDossier(folder, folder + ".zip").then(() => {
        socket.emit("zip-rd");
      });
    }
  });

  // Pourcentage de progression.
  downloader_audio.on("progress", (progress) => {
    socket.emit("dl-update", Math.round(JSON.parse(JSON.stringify(progress)).progress.percentage) + "%");
  });

  // Si erreurs.
  downloader_audio.on("error", (err) => {
    socket.emit("erreur", "Problèmes avec le téléchargement de la vidéo.");
    console.error("Problèmes avec le téléchargement : " + err);

    socket.emit("gif-off");
  });
}

// Fonction permettant de compresser le dossier.
const zipDossier = (source, out) => {
  const archive = archiver('zip', { zlib: { level: 9 } });
  const stream = fs.createWriteStream(out);

  return new Promise((resolve, reject) => {
    archive.directory(source, false)
      .on('error', err => reject(err))
      .pipe(stream);

    stream.on('close', () => resolve());
    archive.finalize();
  });
}

