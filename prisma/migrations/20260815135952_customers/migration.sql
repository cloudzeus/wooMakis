CREATE TYPE "CustomerSource" AS ENUM ('WOO', 'GUEST', 'LOCAL');

CREATE TABLE "Customer" (
  "id"            TEXT NOT NULL,
  "wooCustomerId" INTEGER,
  "source"        "CustomerSource" NOT NULL DEFAULT 'WOO',
  "SODTYPE"       INTEGER NOT NULL DEFAULT 13,
  "CODE"          TEXT,
  "NAME"          TEXT NOT NULL,
  "AFM"           TEXT,
  "IRSDATA"       TEXT,
  "JOBTYPETRD"    TEXT,
  "ADDRESS"       TEXT,
  "ZIP"           TEXT,
  "DISTRICT"      TEXT,
  "CITY"          TEXT,
  "COUNTRY"       TEXT,
  "PHONE01"       TEXT,
  "EMAIL"         TEXT,
  "WEBPAGE"       TEXT,
  "ISACTIVE"      INTEGER NOT NULL DEFAULT 1,
  "REMARKS"       TEXT,
  "firstName"     TEXT,
  "lastName"      TEXT,
  "company"       TEXT,
  "orderCount"    INTEGER NOT NULL DEFAULT 0,
  "totalSpent"    DECIMAL(12,2) NOT NULL DEFAULT 0,
  "lastOrderAt"   TIMESTAMP(3),
  "wooSnapshot"   JSONB,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Customer_wooCustomerId_key" ON "Customer"("wooCustomerId");
CREATE INDEX "Customer_source_idx" ON "Customer"("source");
CREATE INDEX "Customer_EMAIL_idx" ON "Customer"("EMAIL");
CREATE INDEX "Customer_NAME_idx" ON "Customer"("NAME");
