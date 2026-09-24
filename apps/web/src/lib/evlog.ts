import { createEvlog } from "evlog/next";
import { createInstrumentation } from "evlog/next/instrumentation/create";

export const { log } = createEvlog({
	service: "emach-ecommerce-web",
});

export const { register, onRequestError } = createInstrumentation({
	service: "emach-ecommerce-web",
});
