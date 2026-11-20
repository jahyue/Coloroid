let peer = null;
let localcamera = document.getElementById("localVideo");
let remotecamera = document.getElementById("remoteVideo");
let invitelink = document.getElementById("invitelink");
let dataConnection = null;
let mediaCall = null;
let inWelcome = true;
let host_ready = false;
let guest_ready = false;
let number_ready = 0;
let countdownStarted = false;
let ConnectionStatus = document.getElementById("Status");
const welcomePage = document.getElementById("welcome");
const photobooth = document.getElementById("photobooth");
const createButton = document.getElementById("createButton");
const startButton = document.getElementById("startButton");
const joinButton = document.getElementById("joinButton");
const camera = document.getElementById("camera");
const ctx = camera.getContext("2d");
const photosDiv = document.getElementById("photos");
const params = new URLSearchParams(window.location.search);
const roomID = params.get("room");
let animationFrameId = null;
let count = null;

function displayPhoto(blob) {
  const image = document.createElement("img");
  image.src = URL.createObjectURL(blob);
  photosDiv.appendChild(image);
}
function handleReceivedData(data) {}
function handleConnectionError(error) {}
function updateReady() {
  number_ready = guest_ready + host_ready;
  if (number_ready == 2) {
    if (!roomID) {
      if (!countdownStarted) {
        dataConnection.send("start-countdown");
        countdownStarted = true;
        startCountdown();
        
      }
    }
  }
  startButton.textContent = `Ready: ${number_ready}/2`;
}
function startCountdown() {
  if (count == null){
    count=3;
  }
  
const timerId = setInterval(() => {
  if (count === 0) {
    count = null;
    clearInterval(timerId);
    return;
  }
  count--;
  
}, 1000);
}
function GoToWelcome() {
  if (!inWelcome) {
    inWelcome = true;
    welcomePage.style.display = "flex";
    photobooth.style.display = "none";
    if (stream) {
      let vids = stream.getTracks();
      vids.forEach((track) => {
        track.stop();
      });

      stream = null;
    }
    localcamera.srcObject = null;
    remotecamera.srcObject = null;
    cancelAnimationFrame(animationFrameId);
    if (dataConnection) {
      dataConnection.close();
    }
    if (mediaCall) {
      mediaCall.close();
    }
  }
}
if (roomID) {
  console.log("guest");
  createButton.style.display = "none";
} else {
  console.log("host");
  joinButton.style.display = "none";
}
function drawframe() {
  const localcropWidth =
    localcamera.videoHeight * (camera.width / 2 / camera.height);
  const localcropX = (localcamera.videoWidth - localcropWidth) / 2;

  animationFrameId = requestAnimationFrame(drawframe);
  if (roomID) {
    ctx.drawImage(
      localcamera,
      localcropX,
      0,
      localcropWidth,
      localcamera.videoHeight,
      camera.width / 2,
      0,
      camera.width / 2,
      camera.height,
    );
  } else {
    ctx.drawImage(
      localcamera,
      localcropX,
      0,
      localcropWidth,
      localcamera.videoHeight,
      0,
      0,
      camera.width / 2,
      camera.height,
    );
  }

  if (remotecamera.readyState >= 2) {
    const remotecropWidth =
      remotecamera.videoHeight * (camera.width / 2 / camera.height);
    const remotecropX = (remotecamera.videoWidth - remotecropWidth) / 2;
    if (roomID) {
      ctx.drawImage(
        remotecamera,
        remotecropX,
        0,
        remotecropWidth,
        remotecamera.videoHeight,
        0,
        0,
        camera.width / 2,
        camera.height,
      );
    } else {
      ctx.drawImage(
        remotecamera,
        remotecropX,
        0,
        remotecropWidth,
        remotecamera.videoHeight,
        camera.width / 2,
        0,
        camera.width / 2,
        camera.height,
      );
    }
  }
  if(count != null){
    ctx.font = "bold 36px Arial";
    ctx.fillStyle = "#000000";
    ctx.fillText(count, 50, 80);
  }
}
let stream = null;
const setupCamera = async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
    localcamera.srcObject = stream;
    await localcamera.play();
    console.log("Camera access granted.");

    drawframe();
    return true;
  } catch (error) {
    switch (error.name) {
      case "NotAllowedError":
        ConnectionStatus.textContent = "Camera Access Denied";
        break;
      case "NotFoundError":
        ConnectionStatus.textContent = "No Camera Found";
        break;
      case "NotReadableError":
        ConnectionStatus.textContent = "Camera Can't Be Accessed";
        break;
      default:
        ConnectionStatus.textContent = "Error Occured";
        break;
    }
    return false;
  }
};
startButton.addEventListener("click", async () => {
  if (host_ready && guest_ready) {
    camera.toBlob(
      (blob) => {
        const newImg = document.createElement("img");
        const url = URL.createObjectURL(blob);

        newImg.src = url;
        photosDiv.appendChild(newImg);
        if (dataConnection && dataConnection.open) {
          dataConnection.send(blob);
          console.log("photo sent");
        } else {
          console.log("data connection not open, photo not sent");
        }
      },
      "image/jpeg",
      0.95,
    );
  } else if (roomID) {
    if (guest_ready == false) {
      guest_ready = true;
      dataConnection.send("guest-ready");
      updateReady();
    }
  } else {
    if (host_ready == false) {
      host_ready = true;
      dataConnection.send("host-ready");
      updateReady();
    }
  }
});
joinButton.addEventListener("click", async () => {
  if (await setupCamera()) {
    inWelcome = false;
    welcomePage.style.display = "none";
    photobooth.style.display = "flex";

    peer = new Peer();
    peer.on("open", (id) => {
      console.log("My peer ID is: " + id);
      mediaCall = peer.call(roomID, stream);
      mediaCall.on("close", () => {
        GoToWelcome();
      });
      dataConnection = peer.connect(roomID);
      dataConnection.on("open", () => {
        ConnectionStatus.textContent = "Connected";
        console.log("Data connection established with host.");
      });
      dataConnection.on("close", () => {
        GoToWelcome();
      });
      dataConnection.on("error", () => {
        ConnectionStatus.textContent = "Data Error";
        GoToWelcome();
      });
      dataConnection.on("data", (data) => {
        if (data instanceof Blob) {
          displayPhoto(data);
        }
        if (data == "host-ready") {
          host_ready = true;
          updateReady();
        }
        if (data == "start-countdown") {
          if (!countdownStarted) {
            countdownStarted = true;
            startCountdown();
            
          }
        }
      });
      mediaCall.on("stream", (remoteStream) => {
        remotecamera.srcObject = remoteStream;
      });
      mediaCall.on("error", (err) => {
        ConnectionStatus.textContent = "Video Failed ";
        GoToWelcome();
      });
    });
    peer.on("error", (err) => {
      switch (err.type) {
        case "peer-unavailable":
          ConnectionStatus.textContent = "Peer Doesnt Exist";

          break;
        case "network":
          ConnectionStatus.textContent = "Lost Connection";

          break;
        case "server-error":
          ConnectionStatus.textContent = "Server Error";

          break;
        default:
          ConnectionStatus.textContent = "Error Occured";

          break;
      }
      GoToWelcome();
    });
  }
});
createButton.addEventListener("click", async () => {
  console.log("host clicked", host_ready, guest_ready);
  if (await setupCamera()) {
    peer = new Peer();
    inWelcome = false;
    peer.on("open", (id) => {
      welcomePage.style.display = "none";
      photobooth.style.display = "flex";
      console.log("My peer ID is: " + id);
      invitelink.textContent = `Share this link to invite someone: https://jahyue.github.io/Coloroid/?room=${id}`;
      invitelink.href = `https://jahyue.github.io/Coloroid/?room=${id}`;
    });
    peer.on("error", (err) => {
      switch (err.type) {
        case "peer-unavailable":
          ConnectionStatus.textContent = "Peer Doesnt Exist";

          break;
        case "network":
          ConnectionStatus.textContent = "Lost Connection";

          break;
        case "server-error":
          ConnectionStatus.textContent = "Server Error";

          break;
        default:
          ConnectionStatus.textContent = "Error Occured";

          break;
      }
      GoToWelcome();
    });
    peer.on("connection", (connection) => {
      dataConnection = connection;
      dataConnection.on("open", () => {
        ConnectionStatus.textContent = "Connected";
        console.log("Data connection established with guest.");
      });
      dataConnection.on("close", () => {
        GoToWelcome();
      });
      dataConnection.on("error", () => {
        ConnectionStatus.textContent = "Data Error";
        GoToWelcome();
      });
      connection.on("data", (data) => {
        if (data instanceof Blob) {
          displayPhoto(data);
        }
        if (data == "guest-ready") {
          guest_ready = true;
          updateReady();
        }
      });
    });

    peer.on("call", (call) => {
      mediaCall = call;
      mediaCall.on("close", () => {
        GoToWelcome();
      });

      console.log("Incoming call from: " + call.peer);
      call.answer(stream);
      call.on("stream", (remoteStream) => {
        remotecamera.srcObject = remoteStream;
      });
      call.on("error", (err) => {
        ConnectionStatus.textContent = "Call Error";
        GoToWelcome();
      });
    });
  }
});
