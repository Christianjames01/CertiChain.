import { useEffect, useState } from "react";

export const prefersReducedMotion = () =>
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function useReveal(rootRef, deps = []) {
    useEffect(() => {
        const root = rootRef.current;
        if (!root) return undefined;
        const items = [...root.querySelectorAll("[data-reveal]:not(.is-in)")];

        if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
            items.forEach((el) => el.classList.add("is-in"));
            return undefined;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("is-in");
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.18, rootMargin: "0px 0px -8% 0px" });

        items.forEach((el) => observer.observe(el));
        return () => observer.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
}

export function useInView(ref, { threshold = 0.35, once = true } = {}) {
    const [inView, setInView] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        if (!("IntersectionObserver" in window)) return undefined;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setInView(true);
                if (once) observer.disconnect();
            } else if (!once) {
                setInView(false);
            }
        }, { threshold });
        observer.observe(el);
        return () => observer.disconnect();
    }, [ref, threshold, once]);

    return inView || typeof IntersectionObserver === "undefined";
}

export function useCountUp(target, active, duration = 1400) {
    const [value, setValue] = useState(0);

    useEffect(() => {
        if (!active || prefersReducedMotion()) return undefined;
        let frame;
        const start = performance.now();
        const tick = (now) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            setValue(Math.round(target * eased));
            if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [target, active, duration]);

    return active && prefersReducedMotion() ? target : value;
}

export function useScrollProgress(ref) {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const el = ref.current;
        if (!el || prefersReducedMotion()) return undefined;
        let frame = null;
        const measure = () => {
            frame = null;
            const rect = el.getBoundingClientRect();
            const vh = window.innerHeight;
            const start = vh * 0.75;
            const end = vh * 0.55;
            const total = rect.height + (start - end);
            const done = start - rect.top;
            setProgress(Math.max(0, Math.min(1, done / total)));
        };
        const onScroll = () => { if (frame === null) frame = requestAnimationFrame(measure); };
        measure();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
            if (frame !== null) cancelAnimationFrame(frame);
        };
    }, [ref]);

    return prefersReducedMotion() ? 1 : progress;
}

export function useMagnetic(ref, strength = 0.25) {
    useEffect(() => {
        const el = ref.current;
        if (!el || prefersReducedMotion() || !window.matchMedia("(hover: hover)").matches) return undefined;
        const move = (e) => {
            const rect = el.getBoundingClientRect();
            const x = (e.clientX - rect.left - rect.width / 2) * strength;
            const y = (e.clientY - rect.top - rect.height / 2) * strength;
            el.style.transform = `translate(${x}px, ${y}px)`;
        };
        const reset = () => { el.style.transform = ""; };
        el.addEventListener("mousemove", move);
        el.addEventListener("mouseleave", reset);
        return () => {
            el.removeEventListener("mousemove", move);
            el.removeEventListener("mouseleave", reset);
        };
    }, [ref, strength]);
}

export function useTicker(running, ms) {
    const [tick, setTick] = useState(0);

    useEffect(() => {
        if (!running) return undefined;
        const id = setInterval(() => setTick((t) => t + 1), ms);
        return () => clearInterval(id);
    }, [running, ms]);

    return tick;
}
