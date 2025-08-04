import { fromEvent, map, tap, catchError, of, interval, mergeMap } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';

const endpoints = Object.freeze({
  startServer:
    'https://startsurfservervm-d9c8hseahzdyfqau.westus3-01.azurewebsites.net/api/StartSurfVM?',
  getServerStatus: 'http://20.163.60.236:8000/status',
});

type ServerStatusResponse = {
  online: boolean;
  name: string;
  map: string;
  playerCount: number;
  maxPlayers: number;
  players: string[];
  uptime: string;
};

function updateServerInfo(
  status: 'online' | 'offline' | 'loading',
  map: string,
  players: number,
  maxPlayers: number,
  uptime: string
): void {
  const statusCard = document.querySelector(
    '[data-title="Status"] [data-description]'
  ) as HTMLElement;
  const playersCard = document.querySelector(
    '[data-title="Players"] [data-description]'
  ) as HTMLElement;
  const uptimeCard = document.querySelector(
    '[data-title="Uptime"] [data-description]'
  ) as HTMLElement;
  const connectIcon = document.querySelector('[data-connect]') as HTMLElement;

  console.log(
    `Updating server info: status=${status}, map=${map}, players=${players}/${maxPlayers}`
  );
  console.log('Status card:', statusCard);
  console.log('Players card:', playersCard);

  const spinners = document.querySelectorAll('[data-spinner]');

  const isLoading = status === 'loading';

  spinners.forEach((spinner) => {
    if (spinner) {
      (spinner as HTMLElement).style.display = isLoading ? 'block' : 'none';
    }
  });

  [statusCard, playersCard, uptimeCard].forEach((card) => {
    if (card) {
      (card as HTMLElement).style.display = isLoading ? 'none' : 'block';
    }
  });

  if (!isLoading) {
    if (statusCard) {
      statusCard.textContent = status;
      statusCard.className = status;
    }
    if (playersCard) {
      playersCard.textContent = `${players} / ${maxPlayers}`;
      playersCard.className = status;
    }
    if (uptimeCard) {
      uptimeCard.textContent = uptime;
      uptimeCard.className = status;
    }

    // Update map image if updateMapDisplay function is available
    if (map !== 'Unknown' && map !== 'loading') {
      updateMapDisplay(map);
    }
  }

  if (connectIcon) {
    switch (status) {
      case 'online':
        connectIcon.style.display = 'block';
        break;
      case 'offline':
        connectIcon.style.display = 'none';
        break;
      case 'loading':
        connectIcon.style.display = 'none';
        break;
    }
  }

  updateStartButton(status);
}

function updateStartButton(status: 'offline' | 'loading' | 'online') {
  const button = document.querySelector(
    '[data-start-button]'
  ) as HTMLButtonElement;
  const buttonText = document.querySelector(
    '[data-button-text]'
  ) as HTMLElement;

  if (!button || !buttonText) return;

  button.classList.remove('loading', 'online', 'offline');

  switch (status) {
    case 'offline':
      button.disabled = false;
      button.classList.add('offline');
      button.setAttribute('data-status', 'offline');
      buttonText.textContent = 'Start Server';
      break;

    case 'loading':
      button.disabled = true;
      button.classList.add('loading');
      button.setAttribute('data-status', 'loading');
      buttonText.textContent = 'Starting...';
      break;

    case 'online':
      button.disabled = true;
      button.classList.add('online');
      button.setAttribute('data-status', 'online');
      buttonText.textContent = 'Server Online';
      break;
  }
}

function updateMapDisplay(newMapName: string) {
  const mapContainer = document.querySelector('.map') as HTMLElement;
  const mapImage = document.querySelector(
    '[data-map-image]'
  ) as HTMLImageElement;
  const mapNameElement = document.querySelector(
    '[data-map-name]'
  ) as HTMLElement;

  if (mapImage && mapNameElement && mapContainer) {
    const mapImages = mapContainer.dataset.mapImages
      ? JSON.parse(mapContainer.dataset.mapImages)
      : {};

    mapNameElement.textContent = newMapName;

    const imageSrc = mapImages[newMapName] || mapImages['default'];

    if (imageSrc) {
      mapImage.src = imageSrc;
      mapImage.alt = newMapName;
      console.log(`Updated map image to: ${newMapName} (${imageSrc})`);
    } else {
      console.warn(`No image found for map: ${newMapName}`);
    }
  }
}

function checkServerStatus() {
  console.log('Checking server status...');

  fromFetch(endpoints.getServerStatus)
    .pipe(
      tap(() => {
        updateServerInfo('loading', 'Unknown', 0, 0, 'offline');
      }),
      map((response) => {
        if (!response.ok) {
          throw new Error('Server response was not ok');
        }
        return response.json();
      }),
      mergeMap((jsonPromise) =>
        jsonPromise.then((data) => data as ServerStatusResponse)
      ),
      tap((data: ServerStatusResponse) => {
        console.log('Server status response:', data);

        if (data.online) {
          updateServerInfo(
            data.online ? 'online' : 'offline',
            data.map,
            data.playerCount,
            data.maxPlayers,
            data.uptime
          );
          console.log('Server is online!', data);
        } else {
          updateServerInfo('offline', 'offline', 0, 0, 'offline');
          console.log('Server is offline');
        }
      }),
      catchError((error) => {
        console.error('Error fetching server status:', error);
        updateServerInfo('offline', 'offline', 0, 0, 'offline');
        return of(null);
      })
    )
    .subscribe();
}

checkServerStatus();

interval(60000).subscribe(() => {
  checkServerStatus();
});

// DEBUGGG TEMPORARY
const mapContainer = document.querySelector('.map') as HTMLElement;
if (mapContainer) {
  const mapImagesData = mapContainer.getAttribute('data-map-images');
  const availableMaps = mapImagesData
    ? Object.keys(JSON.parse(mapImagesData))
    : [];
  console.log('Available map images:', availableMaps);
}

const startButton = document.querySelector('[data-start-button]');
if (startButton) {
  fromEvent(startButton, 'click').subscribe(() => {
    updateServerInfo('loading', 'loading', 0, 0, 'loading');

    fromFetch(endpoints.startServer)
      .pipe(
        map((response) => {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          return response.json();
        }),
        tap(() => {
          console.log('Surf server started successfully');
          setTimeout(() => checkServerStatus(), 10000);
        }),
        catchError((error) => {
          console.error('Error starting surf server:', error);
          updateStartButton('offline');
          return of(null);
        })
      )
      .subscribe();
  });
}

const connectIcon = document.querySelector('[data-connect]') as HTMLElement;
if (connectIcon) {
  fromEvent(connectIcon, 'click').subscribe(() => {
    const connectUrl = `steam://connect/20.163.60.236:27015/footwork`;
    window.open(connectUrl);
  });
}
