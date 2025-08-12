import {
  fromEvent,
  map,
  tap,
  catchError,
  of,
  interval,
  mergeMap,
  switchMap,
  Subscription,
  takeWhile,
} from 'rxjs';
import { fromFetch } from 'rxjs/fetch';

const endpoints = Object.freeze({
  startServer:
    'https://startsurfservervm-d9c8hseahzdyfqau.westus3-01.azurewebsites.net/api/StartSurfVM?',
  getServerStatus:
    'https://startsurfservervm-d9c8hseahzdyfqau.westus3-01.azurewebsites.net/api/GetServerStatus?',
});

const STATUS_CHECK_INTERVAL = 60000;
const STARTUP_CHECK_INTERVAL = 5000;

type ServerStatusResponse = {
  online: boolean;
  name: string;
  map: string;
  playerCount: number;
  maxPlayers: number;
  players: string[];
  uptime: string;
};

type Status = 'online' | 'offline' | 'loading';

function updateServerState(
  status: Status,
  payload?: Omit<ServerStatusResponse, 'online' | 'players' | 'name'>
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
  const mainContainer = document.querySelector(
    '[data-main-container]'
  ) as HTMLElement;
  const spinners = document.querySelectorAll(
    '[data-spinner]'
  ) as NodeListOf<HTMLElement>;

  const isLoading = status === 'loading';

  // update loading spinners
  spinners.forEach((spinner) => {
    if (spinner) spinner.style.display = isLoading ? 'block' : 'none';
  });

  // update status, players, and uptime info pills
  [statusCard, playersCard, uptimeCard].forEach((card) => {
    if (card) card.style.display = isLoading ? 'none' : 'block';
  });

  // update main container loading animation
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

  // update map, status, players, and uptime cards
  if (!isLoading) {
    if (statusCard) {
      statusCard.textContent = status;
      statusCard.className = status;
    }
    if (playersCard) {
      playersCard.textContent = `${payload?.playerCount ?? 0} / ${
        payload?.maxPlayers ?? 0
      }`;
      playersCard.className = status;
    }
    if (uptimeCard) {
      uptimeCard.textContent = payload?.uptime ?? 'Unknown';
      uptimeCard.className = status;
    }

    if (
      payload?.map &&
      payload.map !== 'Unknown' &&
      payload.map !== 'loading'
    ) {
      updateMapDisplay(payload.map);
    }
  }

  updateConnectButton(status);
  updateStartButton(status);
}

function updateConnectButton(status: Status) {
  const connectIcon = document.querySelector('[data-connect]') as HTMLElement;

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
}

function updateStartButton(status: Status) {
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
      buttonText.textContent = 'Loading...';
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

    mapImage.src = imageSrc;
    mapImage.alt = newMapName;
  }
}

let isServerStarting = false;
let statusCheckSubscription$: Subscription;

function checkServerStatus(updateUI = false) {
  if (!isServerStarting && updateUI) {
    updateServerState('loading');
  }

  fromFetch(endpoints.getServerStatus)
    .pipe(
      switchMap((response) => {
        if (!response.ok) {
          throw new Error('Server status was not ok');
        }

        return response.json();
      }),
      tap((data: ServerStatusResponse) => {
        if (data.online) {
          updateServerState('online', data);
          isServerStarting = false;
        } else {
          if (!isServerStarting && updateUI) {
            updateServerState('offline', data);
          }
        }
      }),
      catchError((error) => {
        if (!isServerStarting && updateUI) {
          updateServerState('offline');
        }
        isServerStarting = false;
        return of(null);
      })
    )
    .subscribe();
}

function startNormalPolling() {
  statusCheckSubscription$ = interval(STATUS_CHECK_INTERVAL).subscribe(() => {
    checkServerStatus(true);
  });
}

function startStartupPolling() {
  statusCheckSubscription$ = interval(STARTUP_CHECK_INTERVAL)
    .pipe(
      tap(() => checkServerStatus()),
      takeWhile(() => isServerStarting, true)
    )
    .subscribe({
      complete: () => {
        startNormalPolling();
      },
    });
}

checkServerStatus(true);
startNormalPolling();

const startButton = document.querySelector('[data-start-button]');
if (startButton) {
  fromEvent(startButton, 'click').subscribe(() => {
    if (isServerStarting) return;

    isServerStarting = true;
    updateServerState('loading');

    if (statusCheckSubscription$) {
      statusCheckSubscription$.unsubscribe();
    }

    fromFetch(endpoints.startServer)
      .pipe(
        switchMap((response) => {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          return response.text();
        }),
        tap((responseText) => {
          console.log('Server starting response:', responseText);
          startStartupPolling();
        }),
        catchError((error) => {
          console.error('Error starting surf server:', error);
          isServerStarting = false;
          updateStartButton('offline');
          startNormalPolling();
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
