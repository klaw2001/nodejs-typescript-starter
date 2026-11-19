-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('account', 'general');

-- CreateEnum
CREATE TYPE "otp_purpose" AS ENUM ('password_reset');

-- CreateTable
CREATE TABLE "sys_module" (
    "module_id" SERIAL NOT NULL,
    "module_key" VARCHAR(255) NOT NULL,
    "module_name" VARCHAR(255),
    "module_status" BOOLEAN NOT NULL DEFAULT true,
    "module_created_by" VARCHAR(25),
    "module_updated_by" VARCHAR(25),
    "module_created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "module_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "module_archived" BOOLEAN NOT NULL DEFAULT false,
    "module_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sys_module_pkey" PRIMARY KEY ("module_id")
);

-- CreateTable
CREATE TABLE "roles" (
    "role_id" SERIAL NOT NULL,
    "role_key" VARCHAR(255) NOT NULL,
    "role_name" VARCHAR(255) NOT NULL,
    "role_description" VARCHAR(255),
    "role_is_system" BOOLEAN NOT NULL DEFAULT false,
    "role_status" BOOLEAN NOT NULL DEFAULT true,
    "role_created_by" VARCHAR(25),
    "role_updated_by" VARCHAR(25),
    "role_created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role_archived" BOOLEAN NOT NULL DEFAULT false,
    "role_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("role_id")
);

-- CreateTable
CREATE TABLE "module_role_map" (
    "mrm_id" SERIAL NOT NULL,
    "mrm_module_id" INTEGER NOT NULL,
    "mrm_role_id" INTEGER NOT NULL,
    "mrm_read" BOOLEAN NOT NULL DEFAULT false,
    "mrm_write" BOOLEAN NOT NULL DEFAULT false,
    "mrm_status" BOOLEAN NOT NULL DEFAULT true,
    "mrm_created_by" VARCHAR(25),
    "mrm_updated_by" VARCHAR(25),
    "mrm_created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mrm_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mrm_archived" BOOLEAN NOT NULL DEFAULT false,
    "mrm_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "module_role_map_pkey" PRIMARY KEY ("mrm_id")
);

-- CreateTable
CREATE TABLE "users" (
    "user_id" SERIAL NOT NULL,
    "user_first_name" VARCHAR(255) NOT NULL,
    "user_last_name" VARCHAR(255) NOT NULL,
    "user_email" VARCHAR(255) NOT NULL,
    "user_mobile" VARCHAR(20),
    "user_password" VARCHAR(255) NOT NULL,
    "user_role_id" INTEGER NOT NULL,
    "user_access_expires_at" TIMESTAMP(3),
    "user_must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "user_token_version" INTEGER NOT NULL DEFAULT 0,
    "user_failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "user_locked_until" TIMESTAMP(3),
    "user_last_login_at" TIMESTAMP(3),
    "user_deactivated_at" TIMESTAMP(3),
    "user_deactivation_reason" VARCHAR(255),
    "user_status" BOOLEAN NOT NULL DEFAULT true,
    "user_created_by" VARCHAR(25),
    "user_updated_by" VARCHAR(25),
    "user_created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_archived" BOOLEAN NOT NULL DEFAULT false,
    "user_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "otp_id" SERIAL NOT NULL,
    "otp_user_id" INTEGER NOT NULL,
    "otp_purpose" "otp_purpose" NOT NULL,
    "otp_code_hash" VARCHAR(255) NOT NULL,
    "otp_expires_at" TIMESTAMP(3) NOT NULL,
    "otp_attempts" INTEGER NOT NULL DEFAULT 0,
    "otp_consumed_at" TIMESTAMP(3),
    "otp_created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("otp_id")
);

-- CreateTable
CREATE TABLE "files" (
    "file_id" SERIAL NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_key" VARCHAR(255) NOT NULL,
    "file_mime" VARCHAR(100) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "file_status" BOOLEAN NOT NULL DEFAULT true,
    "file_created_by" VARCHAR(25),
    "file_updated_by" VARCHAR(25),
    "file_created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "file_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "file_archived" BOOLEAN NOT NULL DEFAULT false,
    "file_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "files_pkey" PRIMARY KEY ("file_id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "ntf_id" SERIAL NOT NULL,
    "ntf_user_id" INTEGER NOT NULL,
    "ntf_type" "notification_type" NOT NULL,
    "ntf_title" VARCHAR(255) NOT NULL,
    "ntf_message" TEXT NOT NULL,
    "ntf_link" VARCHAR(255),
    "ntf_read_at" TIMESTAMP(3),
    "ntf_emailed_at" TIMESTAMP(3),
    "ntf_created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("ntf_id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "al_id" SERIAL NOT NULL,
    "al_user_id" INTEGER,
    "al_action" VARCHAR(100) NOT NULL,
    "al_entity" VARCHAR(50) NOT NULL,
    "al_entity_id" INTEGER,
    "al_meta" JSONB,
    "al_ip" VARCHAR(64),
    "al_user_agent" VARCHAR(255),
    "al_created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("al_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sys_module_module_key_key" ON "sys_module"("module_key");

-- CreateIndex
CREATE UNIQUE INDEX "roles_role_key_key" ON "roles"("role_key");

-- CreateIndex
CREATE INDEX "role_status_index" ON "roles"("role_status");

-- CreateIndex
CREATE INDEX "mrm_role_module_index" ON "module_role_map"("mrm_role_id", "mrm_module_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_user_email_key" ON "users"("user_email");

-- CreateIndex
CREATE UNIQUE INDEX "users_user_mobile_key" ON "users"("user_mobile");

-- CreateIndex
CREATE INDEX "user_status_index" ON "users"("user_status");

-- CreateIndex
CREATE INDEX "user_role_index" ON "users"("user_role_id");

-- CreateIndex
CREATE INDEX "otp_user_purpose_index" ON "otp_codes"("otp_user_id", "otp_purpose");

-- CreateIndex
CREATE UNIQUE INDEX "files_file_key_key" ON "files"("file_key");

-- CreateIndex
CREATE INDEX "file_status_index" ON "files"("file_status");

-- CreateIndex
CREATE INDEX "ntf_user_read_index" ON "notifications"("ntf_user_id", "ntf_read_at");

-- CreateIndex
CREATE INDEX "al_entity_index" ON "audit_logs"("al_entity", "al_entity_id");

-- CreateIndex
CREATE INDEX "al_user_index" ON "audit_logs"("al_user_id");

-- CreateIndex
CREATE INDEX "al_created_index" ON "audit_logs"("al_created_at");

-- AddForeignKey
ALTER TABLE "module_role_map" ADD CONSTRAINT "module_role_map_mrm_module_id_fkey" FOREIGN KEY ("mrm_module_id") REFERENCES "sys_module"("module_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_role_map" ADD CONSTRAINT "module_role_map_mrm_role_id_fkey" FOREIGN KEY ("mrm_role_id") REFERENCES "roles"("role_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_user_role_id_fkey" FOREIGN KEY ("user_role_id") REFERENCES "roles"("role_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_otp_user_id_fkey" FOREIGN KEY ("otp_user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_ntf_user_id_fkey" FOREIGN KEY ("ntf_user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_al_user_id_fkey" FOREIGN KEY ("al_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

