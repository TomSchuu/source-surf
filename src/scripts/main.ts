import { fromEvent, map, tap, catchError, of, interval, mergeMap } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';

const endpoints = Object.freeze({
  startServer:
    'https://startsurfservervm-d9c8hseahzdyfqau.westus3-01.azurewebsites.net/api/StartSurfVM?',
  getServerStatus:
    'https://startsurfservervm-d9c8hseahzdyfqau.westus3-01.azurewebsites.net/api/GetServerStatus?',
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
  const mainContainer = document.querySelector(
    '[data-main-container]'
  ) as HTMLElement;

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

  if (mainContainer) {
    switch (status) {
      case 'loading':
        mainContainer.classList.add('loading');
        break;
      default:
        mainContainer.classList.remove('loading');
        break;
    }
  }

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
    } else {
      console.warn(`No image found for map: ${newMapName}`);
    }
  }
}

let isStartingServer = false;

function checkServerStatus() {
  console.log('Checking server status...');

  if (isStartingServer) {
    console.log('Skipping status check - server is starting');
    return;
  }

  fromFetch(endpoints.getServerStatus)
    .pipe(
      tap(() => {
        if (!isStartingServer) {
          updateServerInfo('loading', 'Unknown', 0, 0, 'offline');
        }
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
        if (!isStartingServer) {
          if (data.online) {
            updateServerInfo(
              data.online ? 'online' : 'offline',
              data.map,
              data.playerCount,
              data.maxPlayers,
              data.uptime
            );
            console.log('Server is online');
          } else {
            updateServerInfo('offline', 'offline', 0, 0, 'offline');
            console.log('Server is offline');
          }
        }
      }),
      catchError((error) => {
        console.error('Error fetching server status:', error);
        if (!isStartingServer) {
          updateServerInfo('offline', 'offline', 0, 0, 'offline');
        }
        return of(null);
      })
    )
    .subscribe();
}

checkServerStatus();

interval(60000).subscribe(() => {
  checkServerStatus();
});

const startButton = document.querySelector('[data-start-button]');
if (startButton) {
  fromEvent(startButton, 'click').subscribe(() => {
    isStartingServer = true;
    updateServerInfo('loading', 'loading', 0, 0, 'loading');

    fromFetch(endpoints.startServer)
      .pipe(
        map((response) => {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          return response.text();
        }),
        mergeMap((responseText) => responseText.then((text) => text as string)),
        tap((responseText) => {
          console.log('Surf server started successfully:', responseText);
          setTimeout(() => {
            isStartingServer = false;
            checkServerStatus();
          }, 27000);
        }),
        catchError((error) => {
          console.error('Error starting surf server:', error);
          isStartingServer = false;
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
