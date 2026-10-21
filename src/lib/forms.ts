import type { SubmitFunction } from '$app/forms';
import { toast } from 'svelte-sonner';

/** `use:enhance` callback that shows `fail(…, { error })` messages as a toast. */
export const reportFailure: SubmitFunction = () => {
	return async ({ result, update }) => {
		if (result.type === 'failure' && typeof result.data?.error === 'string')
			toast.error(result.data.error);
		await update();
	};
};
