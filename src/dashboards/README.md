# LATIF NI Dashboards

Enterprise web dashboards for real-time monitoring and agent orchestration.

## Dashboards

### latif-ni-dashboard.html

**Primary Enterprise Dashboard** — Complete system monitoring and control interface.

**Port:** 3001 (via backend service)

**Access:** `http://localhost:3001`

**Features:**
- **Agent Network Visualization**: Shows all 9 agents with status indicators
- **System Monitoring**: Real-time CPU, RAM, GPU, temperature charts
- **Workspace Cards**: Quick access to 4 workspaces
- **Quick Actions**: New Chat, Upload, Project, Voice, Tools, Settings
- **Activity Timeline**: Recent agent actions with timestamps
- **Model Status**: Active models with storage usage
- **Mobile Responsive**: Adapts to any screen size
- **Real-time WebSocket**: Automatic metric updates

**Design Features:**
- Dark-themed modern UI
- Smooth animations and transitions
- GPU-accelerated CSS performance
- Touch-optimized for mobile
- Accessibility-focused

**Layout:**
```
┌─────────────────────────────────────────┐
│         Header with Logo                │
├─────────┬───────────────────────────────┤
│ Sidebar │  Agent Network Grid           │
│ Nav     ├───────────────────────────────┤
│         │ System Metrics (Charts)       │
│         ├───────────────────────────────┤
│         │ Workspaces & Quick Actions    │
│         ├───────────────────────────────┤
│         │ Recent Activity               │
│         ├───────────────────────────────┤
│         │ Model Status                  │
└─────────┴───────────────────────────────┘
```

**Mobile Layout:**
```
┌──────────────────────────┐
│    Header & Logo         │
├──────────────────────────┤
│  Agent Network (vertical)│
├──────────────────────────┤
│  Metrics & Status        │
├──────────────────────────┤
│  Activity Feed           │
├──────────────────────────┤
│  Bottom Navigation       │
│  (Chat|Project|Tools|■)  │
└──────────────────────────┘
```

### latif-web.html

**Lightweight Chat Interface** — Simple chat UI with backend connectivity.

**Port:** 3000 or standalone

**Access:** 
- Standalone: Open directly in browser
- With backend: Configure backend URL in settings

**Features:**
- Clean chat interface
- Model selector dropdown
- Theme switcher (Synthwave, Matrix Green, Underwave)
- Settings panel with backend configuration
- Demo mode support
- Real-time streaming responses
- Chat history management

**Design Themes:**
- **Synthwave**: Neon magenta and cyan colors
- **Matrix Green**: Classic green terminal aesthetic
- **Underwave**: Purple and teal combination

**Use Cases:**
- Lightweight testing of Ollama connection
- Standalone chat without full dashboard
- Development and debugging
- Mobile-friendly chat interface

## Configuration

### Backend Connection

Both dashboards automatically detect backend service:

1. **Default**: `http://localhost:3001`
2. **LAN Access**: Update in settings to machine IP (e.g., `192.168.1.100:3001`)
3. **Custom Port**: Edit in settings

### Theme Selection

Dashboard and chat interface support multiple themes:
- Edit theme variable in settings
- Persisted to localStorage
- Applied on page reload

### API Endpoint Configuration

For standalone use, configure:
- Ollama endpoint: `http://localhost:11434`
- Chat API: `http://localhost:3000/api/chat`
- Backend service: `http://localhost:3001`

## Integration

### With Backend Service

Dashboard connects to backend on load:
1. Fetches initial state via `GET /api/dashboard`
2. Establishes WebSocket connection to `ws://localhost:3001`
3. Receives metric updates every 2 seconds
4. Sends agent execution commands via WebSocket

### With LATIF V5 API

Chat interface can connect to LATIF API:
1. POST to `http://localhost:3000/api/chat` for responses
2. Use streaming or non-streaming modes
3. Leverage Ollama models and RAG

## Performance

### Rendering Performance
- Real-time chart updates (60fps)
- GPU-accelerated animations
- Efficient DOM updates
- Lazy loading of images

### Network Performance
- WebSocket binary frames (when applicable)
- Gzip compression support
- Optimized JSON payload sizes
- Automatic reconnection on disconnect

### Browser Compatibility
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile Safari 14+

## Customization

### Colors and Theming

Edit CSS custom properties for quick customization:

```css
:root {
  --color-primary: #8b5cf6;
  --color-secondary: #ec4899;
  --color-background: #0f172a;
  --color-surface: #1e293b;
  --color-text: #e2e8f0;
  --color-text-muted: #94a3b8;
}
```

### Responsive Breakpoints

- **Mobile**: < 640px
- **Tablet**: 640px - 1024px
- **Desktop**: > 1024px

Edit in CSS media queries or adjust flexbox grid layout.

### Agent Colors

Add or modify agent colors in `initializeAgents()`:

```javascript
agents.push({
  id: 'new-agent',
  name: 'New Agent',
  color: '#new-hex-color',
  icon: '🎯'
});
```

## Development

### Local Development

Serve dashboards via simple HTTP server:

```bash
# Using Python 3
python -m http.server 8000 --directory src/dashboards

# Using Node.js http-server
npx http-server src/dashboards -p 8000

# Using npm start (already includes dashboards)
npm start
```

### Browser DevTools

1. Open Chrome DevTools (F12)
2. Use Console for WebSocket debugging
3. Check Network tab for API calls
4. Use Performance tab for profiling

### Debugging WebSocket

In browser console:

```javascript
// Check WebSocket connection
window.ws // Shows WebSocket object if connected
window.ws.readyState // 1 = OPEN, 0 = CONNECTING, 2 = CLOSING, 3 = CLOSED
window.ws.url // Shows connected URL

// Monitor WebSocket messages
window.ws.addEventListener('message', (e) => console.log('WS:', JSON.parse(e.data)));
```

## Deployment

### Production Build

No build required — dashboards are pure HTML/CSS/JavaScript.

**Deployment steps:**
1. Copy `.html` files to web server
2. Ensure backend service is running on configured port
3. Update API endpoint URLs if needed
4. Open in browser

### Bundling with Application

Dashboards are self-contained and can be:
- Served by Express.js in `src/main.js`
- Deployed as static files
- Embedded in Electron/WebView apps
- Converted to desktop app via Tauri/Electron

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY . .
RUN npm install
EXPOSE 3000 3001

CMD ["npm", "run", "dev:full"]
```

## Troubleshooting

### Dashboard Not Connecting to Backend

1. Verify backend service running: `http://localhost:3001/api/health`
2. Check browser console for WebSocket errors
3. Verify firewall allows port 3001
4. Try refreshing page

### Metrics Not Updating

1. Check WebSocket connection in DevTools Network tab
2. Verify backend is broadcasting (`ws.send()`)
3. Check browser console for JavaScript errors
4. Monitor backend service logs

### Theme Not Applying

1. Clear browser localStorage
2. Hard refresh (Ctrl+F5 or Cmd+Shift+R)
3. Check CSS is loaded (DevTools Styles tab)
4. Verify theme variable in JavaScript

### Slow Performance on Mobile

1. Reduce chart update frequency (edit metric interval)
2. Disable animations temporarily
3. Close other tabs and apps
4. Use lighter browser (e.g., Chrome vs. Firefox)
5. Use smaller device screen size (lower resolution = faster render)

## Future Enhancements

- [ ] Dashboard widget library
- [ ] Custom widget creation
- [ ] Drag-and-drop layout
- [ ] Workflow builder UI
- [ ] Agent performance analytics
- [ ] Audit log viewer
- [ ] Settings persistence backend
- [ ] Multi-user dashboards
- [ ] Export metrics as CSV/PDF
- [ ] Dark/light mode toggle

## Support

For issues:
1. Check ENTERPRISE_INFRASTRUCTURE.md
2. Verify backend service is running
3. Check browser console for errors
4. Inspect Network tab in DevTools
5. Review backend logs for API errors

---

Last Updated: July 17, 2026
