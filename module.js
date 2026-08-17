const travelWorld = window.WorldModuleSdk.world;
const trips = window.TRIPS || [];
let disposers = [];
let connected = false;

function tripReference(trip) {
  return {
    type: "travel.trip",
    id: trip.id,
    title: `${trip.destination} · ${trip.dates}`,
    data: {
      country: trip.country,
      destination: trip.destination,
      dates: trip.dates,
      startDate: trip.startDate,
      endDate: trip.endDate,
      duration: trip.duration,
      status: trip.status,
      summary: trip.summary,
    },
  };
}

function dayReference(trip, day, index) {
  return {
    type: "travel.day",
    id: `${trip.id}:day:${index + 1}`,
    title: `${trip.destination} · ${day.date} · ${day.title}`,
    data: {
      tripId: trip.id,
      destination: trip.destination,
      date: day.date,
      weekday: day.weekday,
      dayNumber: index + 1,
      title: day.title,
      items: day.items,
    },
  };
}

function referenceFor(element) {
  const trip = trips.find((item) => item.id === element.dataset.tripId);
  if (!trip) return undefined;
  if (element.dataset.worldKind === "trip") return tripReference(trip);
  if (element.dataset.worldKind === "day") {
    const index = Number(element.dataset.dayIndex);
    const day = trip.days[index];
    if (day) return dayReference(trip, day, index);
  }
}

function setButtonState(button, label, state = "") {
  button.textContent = label;
  button.dataset.state = state;
}

async function installReferences() {
  if (!connected) return;
  for (const dispose of disposers) dispose();
  disposers = [];

  for (const element of document.querySelectorAll("[data-world-kind]")) {
    const reference = referenceFor(element);
    if (!reference) continue;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "world-reference-button";
    button.setAttribute("aria-label", `引用 ${reference.title} 到 Capital AI`);
    setButtonState(button, "拖到 AI · 点击引用");
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      setButtonState(button, "正在引用…", "loading");
      try {
        await travelWorld.addReference(reference);
        setButtonState(button, "已引用到 AI", "success");
        window.setTimeout(() => setButtonState(button, "拖到 AI · 点击引用"), 1800);
      } catch (reason) {
        console.error(reason);
        setButtonState(button, "引用失败", "error");
      }
    });
    element.append(button);

    const disposeDrag = await travelWorld.makeReferenceDraggable(element, reference, {
      onReferenced: () => setButtonState(button, "已引用到 AI", "success"),
      onError: () => setButtonState(button, "引用失败", "error"),
    });
    disposers.push(() => {
      disposeDrag();
      button.remove();
    });
  }
}

travelWorld.connect().then(() => {
  connected = true;
  document.documentElement.classList.add("world-connected");
  void installReferences();
}).catch((reason) => {
  console.error(reason);
  travelWorld.reportStartupFailure({
    stage: "dependency-load",
    code: "travel-reference-bootstrap-failed",
    message: "Travel Journal could not connect its references to World.",
  });
});

window.addEventListener("travel:rendered", () => void installReferences());
