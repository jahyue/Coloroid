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
let targetTime = null;
let photocount = 0;
let output = document.getElementById("output");
let outputctx = output.getContext("2d");
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
const result = document.querySelector(".result-section");
const countdown = document.querySelector("#countdownDisplay");
const flash = document.querySelector("#flash");
let animationFrameId = null;
let count = null;
let timerId = null;
function reset() {
  photocount = 0;
  photosDiv.replaceChildren();
  host_ready = false;
  guest_ready = false;
  number_ready = 0;
  result.style.display = "none";
  photobooth.style.display = "flex";
  startButton.textContent = `Ready: 0/2`;
  outputctx.clearRect(0, 0, output.width, output.height);
  countdownStarted = false;
  count = null;
  targetTime = null;
  clearInterval(timerId);
  timerId = null;
}
function triggerFlash() {
  flash.classList.remove("active");
  void flash.offsetWidth;
  flash.classList.add("active");
}
function drawPhotostrip() {
  if (
    photosDiv.children.length == 3 &&
    Array.from(photosDiv.children).every(
      (photo) => photo.complete && photo.naturalWidth > 0,
    )
  ) {
    outputctx.clearRect(0, 0, output.width, output.height);

    outputctx.fillStyle = "#C8B6E8";
    outputctx.fillRect(0, 0, output.width, output.height);
    for (let i = 0; i < 3; i++) {
      outputctx.drawImage(photosDiv.children[i], 40, i * 504 + 40);
    }
    outputctx.font = "36px fredoka 600";
    outputctx.fillStyle = "#493B50";
    outputctx.textAlign = "center";
    outputctx.fillText("COLOROID", 360, 1590);
    photobooth.style.display = "none";
    result.style.display = "flex";
  }
}
function displayPhoto(blob) {
  const image = document.createElement("img");
  image.src = URL.createObjectURL(blob);
  photosDiv.appendChild(image);
  image.onload = () => {
    drawPhotostrip();
  };
}
function capturephoto() {
  triggerFlash();
  dataConnection.send("flash");
  camera.toBlob(
    (blob) => {
      displayPhoto(blob);
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
}
function startPhotoSession() {
  if (photocount < 3) {
    photocount++;

    capturephoto();
    if (photocount !== 3) {
      targetTime = Date.now() + 3000;
      dataConnection.send({ timestamp: targetTime, type: "start-countdown" });
      countdownStarted = true;
      startCountdown(targetTime);
    }
  }
}
function updateReady() {
  number_ready = guest_ready + host_ready;
  if (number_ready == 2) {
    if (!roomID) {
      if (!countdownStarted) {
        targetTime = Date.now() + 3000;
        dataConnection.send({ timestamp: targetTime, type: "start-countdown" });
        countdownStarted = true;
        startCountdown(targetTime);
      }
    }
  }
  startButton.textContent = `Ready: ${number_ready}/2`;
}
function startCountdown(timestamp) {
  if (count == null) {
    count = Math.ceil((timestamp - Date.now()) / 1000);
  }

  timerId = setInterval(() => {
    if (Date.now() >= timestamp) {
      count = null;
      clearInterval(timerId);
      timerId = null;
      countdownStarted = false;
      if (!roomID) {
        startPhotoSession();
      }
      return;
    }

    count = Math.ceil((timestamp - Date.now()) / 1000);
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

  if (count) {
    countdown.textContent = count;
  } else {
    countdown.textContent = "";
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
  if (roomID) {
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
        if (data instanceof Uint8Array) {
          data = new Blob([data], { type: "image/jpeg" });
          displayPhoto(data);
        }
        if (data == "host-ready") {
          host_ready = true;
          updateReady();
        }
        if (data == "retake") {
          reset();
        }
        if (data == "flash") {
          triggerFlash();
        }
        if (typeof data == "object") {
          if (data.type == "start-countdown") {
            if (!countdownStarted) {
              countdownStarted = true;
              startCountdown(data.timestamp);
            }
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
        if (data == "guest-ready") {
          guest_ready = true;
          updateReady();
        } else if (data == "retake") {
          reset();
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
document.querySelector("#retake").addEventListener("click", async () => {
  dataConnection.send("retake");
  reset();
});
document.getElementById("download").addEventListener("click", () => {
  const image = document.getElementById("output");
  const link = document.createElement("a");

  image.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = "downloaded-photo.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, "image/png");
});
