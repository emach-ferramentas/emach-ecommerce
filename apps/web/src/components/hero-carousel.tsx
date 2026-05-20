"use client";

import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@emach/ui/components/carousel";
import { cn } from "@emach/ui/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EmachButton } from "@/components/emach-button";

type HeroSlide = {
  bg: string;
  product: string;
  alt: string;
};

const HERO_SLIDES: HeroSlide[] = [
  {
    bg: "/images/hero-imagens/emach_hero_01_bg.png",
    product: "/images/hero-imagens/emach_hero_01_product.png",
    alt: "EMACH — Potência redefinida",
  },
  {
    bg: "/images/hero-imagens/emach_hero_02_bg.png",
    product: "/images/hero-imagens/emach_hero_02_product.png",
    alt: "EMACH — Linha profissional",
  },
  {
    bg: "/images/hero-imagens/emach_hero_03_bg.png",
    product: "/images/hero-imagens/emach_hero_03_product.png",
    alt: "EMACH — Engenharia EMACH",
  },
];

const AUTOPLAY_INTERVAL = 9000;

type HeroSlideContentProps = {
  slide: HeroSlide;
  isActive: boolean;
  reduceMotion: boolean;
};

function HeroSlideContent({
  slide,
  isActive,
  reduceMotion,
}: HeroSlideContentProps) {
  const entranceInitial = reduceMotion
    ? { opacity: 0 }
    : { opacity: 0, scale: 1.15, filter: "blur(20px)" };
  const entranceAnimate = reduceMotion
    ? { opacity: 1 }
    : { opacity: 1, scale: 1, filter: "blur(0px)" };

  const floatAnimate = reduceMotion ? undefined : { y: [0, -15, 0] };
  const floatTransition = reduceMotion
    ? undefined
    : ({
        duration: 5,
        repeat: Number.POSITIVE_INFINITY,
        ease: "easeInOut",
      } as const);

  const glowAnimate = reduceMotion
    ? undefined
    : { scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] };
  const glowTransition = reduceMotion
    ? undefined
    : ({
        duration: 4,
        repeat: Number.POSITIVE_INFINITY,
        ease: "easeInOut",
      } as const);

  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 z-0">
        <Image
          alt={slide.alt}
          className="object-cover"
          fill
          priority
          quality={100}
          sizes="100vw"
          src={slide.bg}
        />
      </div>

      <motion.div
        animate={glowAnimate}
        aria-hidden="true"
        className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute top-1/2 left-1/2 z-5 h-[900px] w-[900px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(230,0,18,0.25) 0%, rgba(230,0,18,0.08) 40%, transparent 70%)",
          filter: "blur(40px)",
        }}
        transition={glowTransition}
      />

      <AnimatePresence>
        {isActive && (
          <motion.div
            animate={entranceAnimate}
            className="pointer-events-none absolute inset-0 z-10"
            initial={entranceInitial}
            style={{ willChange: "opacity, filter" }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <motion.div
              animate={floatAnimate}
              className="absolute inset-0"
              style={{
                filter: "drop-shadow(0 60px 40px rgba(0,0,0,0.6))",
                willChange: "transform",
              }}
              transition={floatTransition}
            >
              <Image
                alt=""
                className="object-contain"
                fill
                priority
                quality={100}
                sizes="(max-width: 768px) 100vw, 2400px"
                src={slide.product}
                unoptimized
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function HeroCarousel() {
  const [api, setApi] = useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const reduceMotion = useReducedMotion() ?? false;

  useEffect(() => {
    if (!api) {
      return;
    }
    setSelectedIndex(api.selectedScrollSnap());
    const onSelect = () => setSelectedIndex(api.selectedScrollSnap());
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  useEffect(() => {
    if (!api) {
      return;
    }
    const id = window.setInterval(() => {
      api.scrollNext();
    }, AUTOPLAY_INTERVAL);
    return () => window.clearInterval(id);
  }, [api]);

  return (
    <section className="relative h-svh w-full overflow-hidden bg-black">
      <Carousel
        className="h-full w-full"
        opts={{ loop: true, align: "start" }}
        setApi={setApi}
      >
        <CarouselContent className="ml-0 h-svh">
          {HERO_SLIDES.map((slide, index) => (
            <CarouselItem className="relative h-svh pl-0" key={slide.bg}>
              <HeroSlideContent
                isActive={index === selectedIndex}
                reduceMotion={reduceMotion}
                slide={slide}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      <div className="-translate-x-1/2 absolute bottom-10 left-1/2 z-20 flex items-center gap-2">
        {HERO_SLIDES.map((slide, index) => (
          <button
            aria-label={`Ir para slide ${index + 1}`}
            className={cn(
              "h-[4px] w-10 cursor-pointer transition-colors duration-200",
              index === selectedIndex ? "bg-emach-red" : "bg-white/30",
            )}
            key={slide.bg}
            onClick={() => api?.scrollTo(index)}
            type="button"
          />
        ))}
      </div>

      <Link className="absolute right-24 bottom-20 z-20" href="/catalog">
        <EmachButton
          icon={<ArrowRight className="size-4" />}
          size="lg"
          variant="primary"
          className="text-xl h-14"
        >
          Ver Catálogo
        </EmachButton>
      </Link>
    </section>
  );
}
