#  Wavelength Web Edition

A sleek, modern, and fully interactive web implementation of the popular board game **Wavelength**. This project brings the social guessing game to the browser with a focus on high-end UI/UX, real-time peer-to-peer connectivity, and a premium feel.

![Wavelength Preview](https://wavelength-game-eta.vercel.app/og-image.jpg) *(Not: Buraya kendi yayındaki sitenin ekran görüntüsünü ekleyebilirsin)*

##  Key Features

-   **Seamless P2P Gameplay**: No centralized server needed. Powered by **PeerJS** for direct browser-to-browser communication.
-   **Modern UI/UX**: Built with **React 19**, **Tailwind CSS**, and **Framer Motion** for smooth, buttery animations.
-   **Audio Experience**:
    -   Ambient background music with an independent volume slider.
    -   Real-time emoji reactions with synchronized sound effects (SFX).
    -   Dynamic "Swoosh" and "Bullseye" sounds for tactical feedback.
-   **Advanced Dial Mechanics**:
    -   A physically-inspired, responsive wavelength dial.
    -   Precision SVG rendering for smooth scoring zones.
    -   Haptic feedback support for mobile devices.
-   **Fun & Interactive**:
    -   Live emoji reactions that float across everyone's screen.
    -   Special "Easter Egg" name triggers for a personalized touch.
    -   Integrated Joker system (Narrow, Double Pts, Extra Word).
-   **Fully Responsive**: Perfectly optimized for both Desktop and Mobile (iOS/Android).

##  Tech Stack

-   **Frontend**: React (Vite)
-   **Styling**: Tailwind CSS, CSS Modules
-   **Animations**: Framer Motion, Lucide React (Icons)
-   **Networking**: PeerJS (WebRTC)
-   **Audio**: Web Audio API (Synthesized sounds & GainNode control)

##  Getting Started

To run this project locally:

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/CanberkSezgin/wavelength-game.git
    cd wavelength-game
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Run the development server**:
    ```bash
    npm run dev
    ```

4.  **Build for production**:
    ```bash
    npm run build
    ```

##  Deployment

The project is optimized for deployment on **Vercel** or **Netlify**. Simply connect your GitHub repository and it will auto-deploy on every push.

##  License

This project is open-source. Feel free to use and modify it for your own gaming nights!

---

* by Canberk Sezgin*
