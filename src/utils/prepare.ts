import { pipe } from '@solana/functional';
import {
  createTransactionMessage,
  setTransactionMessageFeePayer,
  appendTransactionMessageInstructions,
  setTransactionMessageLifetimeUsingBlockhash,
  type Instruction,
  address,
  compileTransaction,
} from '@solana/kit';
import { getComputeBudget } from './compute';
import { rpc } from './rpc';

export async function prepareTransaction(
  instructions: Instruction<string>[],
  feePayer: string,
) {
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  const finalInstructions = await getComputeBudget(
    instructions,
    feePayer,
    {},
    latestBlockhash
  );
  const payer = address(feePayer);
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    tx => setTransactionMessageFeePayer(payer, tx),
    tx => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    tx => appendTransactionMessageInstructions(finalInstructions, tx),
  );
  return compileTransaction({
    ...message,
    lifetimeConstraint: latestBlockhash,
  });
}
