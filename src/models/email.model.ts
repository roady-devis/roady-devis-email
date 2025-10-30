import mongoose, { Schema, Document } from "mongoose";

export interface IEmail extends Document {
  from: string;
  to: string[];
  subject: string;
  body: string;
  bodyHtml?: string;
  receivedAt: Date;
  attachments: Array<{
    filename: string;
    path: string;
    size: number;
    contentType: string;
  }>;
  processed: boolean;
  processedAt?: Date;
  error?: string;
  metadata?: {
    messageId?: string;
    inReplyTo?: string;
    references?: string[];
  };
}

const emailSchema = new Schema<IEmail>(
  {
    from: { type: String, required: true, index: true },
    to: [{ type: String, required: true }],
    subject: { type: String, required: true },
    body: { type: String, required: true },
    bodyHtml: String,
    receivedAt: { type: Date, default: Date.now, index: true },
    attachments: [
      {
        filename: String,
        path: String,
        size: Number,
        contentType: String,
      },
    ],
    processed: { type: Boolean, default: false, index: true },
    processedAt: Date,
    error: String,
    metadata: {
      messageId: String,
      inReplyTo: String,
      references: [String],
    },
  },
  { timestamps: true }
);

export const Email = mongoose.model<IEmail>("Email", emailSchema);
