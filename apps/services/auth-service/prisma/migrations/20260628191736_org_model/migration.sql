-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "tenant" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDepartment" (
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "isManager" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UserDepartment_pkey" PRIMARY KEY ("userId","departmentId")
);

-- CreateTable
CREATE TABLE "Compartment" (
    "id" TEXT NOT NULL,
    "tenant" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Compartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCompartment" (
    "userId" TEXT NOT NULL,
    "compartmentId" TEXT NOT NULL,

    CONSTRAINT "UserCompartment_pkey" PRIMARY KEY ("userId","compartmentId")
);

-- CreateIndex
CREATE INDEX "Department_parentId_idx" ON "Department"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_tenant_slug_key" ON "Department"("tenant", "slug");

-- CreateIndex
CREATE INDEX "UserDepartment_departmentId_idx" ON "UserDepartment"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Compartment_tenant_key_key" ON "Compartment"("tenant", "key");

-- CreateIndex
CREATE INDEX "UserCompartment_compartmentId_idx" ON "UserCompartment"("compartmentId");

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDepartment" ADD CONSTRAINT "UserDepartment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDepartment" ADD CONSTRAINT "UserDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCompartment" ADD CONSTRAINT "UserCompartment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCompartment" ADD CONSTRAINT "UserCompartment_compartmentId_fkey" FOREIGN KEY ("compartmentId") REFERENCES "Compartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
