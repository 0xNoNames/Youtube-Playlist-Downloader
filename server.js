"use strict";
const express = require("express");
const app = express();
const httpServer = require("http").createServer(app);
const cors = require("cors");

const io = require("socket.io")(httpServer);

const fs = require("fs");

const youtube_info = require("ytdl-core");
const youtube_playlist = require("ytpl");

const mp3_dl = require("youtube-mp3-downloader");
const downloader_audio = new mp3_dl({
  ffmpegPath: "/usr/local/Cellar/ffmpeg/4.4_2/bin/ffmpeg",
  youtubeVideoQuality: "highestaudio",
  "progressTimeout": 250,
  "queueParallelism": 10
});

var cpt_playlist;

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
    console.log(socket.id + " disconnected.");
    if (fs.existsSync(`private/${socket.id}`))
      fs.rmSync(`private/${socket.id}`, { recursive: true });
  });

  socket.on("url", (msg) => {
    let url = decodeURI(encodeURI(msg));

    if (youtube_info.validateURL(url)) {
      var id = youtube_info.getURLVideoID(url)

      // Si la vidéo vient d'une playlist, on enlève les caractères en trop de l'id.
      // if (id.includes("&")) id = id.slice(0, id.indexOf("&"));

      socket.emit("info", "Il y a 1 musique");
      socket.emit("gif-on");

      youtube_info.getBasicInfo(id).then((data) => {
        if (data.videoDetails.lengthSeconds <= 600)
          telechargerFichier(id, socket);
        else {
          socket.emit("erreur", "Vidéo trop longue, max 10mn");
          console.error("Vidéo trop longue");
          socket.emit("gif-off");
        }
      });
    } else if (url.includes("playlist")) {
      youtube_playlist(url)
        .then((data) => {
          socket.emit(
            "info",
            "Il reste " + data.estimatedItemCount + " musiques"
          );
          socket.emit("gif-on");

          cpt_playlist = data.estimatedItemCount * data.estimatedItemCount - data.estimatedItemCount;

          data.items.forEach((video) => {
            console.log(video.title);
            if (video.durationSec <= 600) {
              telechargerFichier(video.id, socket, data.estimatedItemCount);
            }
            else {
              socket.emit("erreur", "Vidéo trop longue, max 10mn");
              console.error("Vidéo trop longue");
              socket.emit("gif-off");
            }
          });
        })
    }
    else {
      socket.emit("erreur", "Mauvais lien");
      console.error("Mauvais lien");
      socket.emit("gif-off");
    }
  });
});



const telechargerFichier = (id, socket, nombre) => {
  fs.mkdirSync(`private/${socket.id}`, { recursive: true });
  downloader_audio.outputPath = `private/${socket.id}`;

  // Télécharge la vidéo.
  downloader_audio.download(id);

  // Data contient les infos sur le fichier téléchargé et envoie les infos au client.
  downloader_audio.on("finished", (err, data) => {
    // var data = fs.readFileSync("private/" + id + ".jpg");
    // var img = Buffer.from(data).toString("base64");
    // socket.emit("miniature", "data:image/png;base64," + img);
    console.log("finished : ", data.videoTitle);

    cpt_playlist--;

    socket.emit("info", "il reste " + cpt_playlist/nombre + " musiques")
    socket.emit("dl-update", data.videoTitle)

    console.log(cpt_playlist);

    if (cpt_playlist == 0) socket.emit("gif-off");
  });

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


app.get("/telecharger", (req, res) => res.download("./file.pdf"));