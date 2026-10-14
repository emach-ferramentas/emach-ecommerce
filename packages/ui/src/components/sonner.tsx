"use client";

import {
	CircleCheckIcon,
	InfoIcon,
	Loader2Icon,
	OctagonXIcon,
	TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const TOASTER_STYLE: React.CSSProperties & {
	"--normal-bg": string;
	"--normal-text": string;
	"--normal-border": string;
	"--border-radius": string;
} = {
	"--normal-bg": "var(--popover)",
	"--normal-text": "var(--popover-foreground)",
	"--normal-border": "var(--border)",
	"--border-radius": "var(--radius)",
};

const Toaster = ({ ...props }: ToasterProps) => (
	<Sonner
		className="toaster group"
		icons={{
			success: <CircleCheckIcon className="size-4" />,
			info: <InfoIcon className="size-4" />,
			warning: <TriangleAlertIcon className="size-4" />,
			error: <OctagonXIcon className="size-4" />,
			loading: <Loader2Icon className="size-4 animate-spin" />,
		}}
		style={TOASTER_STYLE}
		theme="light"
		{...props}
	/>
);

export { Toaster };
