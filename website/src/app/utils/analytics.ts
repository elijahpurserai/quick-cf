import ReactGA from "react-ga4";

const MEASUREMENT_ID = "G-JYNZXCQHMM";

export const initGA = () => {
    ReactGA.initialize(MEASUREMENT_ID);
};

export const trackPageView = (path: string) => {
    ReactGA.send({ hitType: "pageview", page: path });
};

export const trackEvent = (name: string, params: Record<string, any>) => {
    ReactGA.event(name, params);
};
