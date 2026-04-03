const sql = require('mssql');

const rawServer = process.env.DB_SERVER || 'localhost';
const serverParts = rawServer.split('\\');
const serverHost = serverParts[0] === '.' ? 'localhost' : serverParts[0];
const instanceName = serverParts[1];

const config = {
  server: serverHost,
  ...(instanceName ? {} : { port: Number(process.env.DB_PORT || 1433) }),
  database: process.env.DB_NAME || 'CRM_Database',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  options: {
    encrypt: String(process.env.DB_ENCRYPT || 'false').toLowerCase() === 'true',
    trustServerCertificate: String(process.env.DB_TRUST_CERT || 'true').toLowerCase() === 'true',
    ...(instanceName ? { instanceName } : {})
  }
};

let poolPromise;

function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(config);
  }
  return poolPromise;
}

async function initializeDatabase() {
  const pool = await getPool();

  // 1. Users
  await pool.request().query(`
    IF OBJECT_ID('dbo.Users', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Users (
        Id        INT IDENTITY(1,1) PRIMARY KEY,
        FullName  NVARCHAR(120) NOT NULL,
        Email     NVARCHAR(255) NOT NULL UNIQUE,
        Password  NVARCHAR(255) NOT NULL,
        Phone     NVARCHAR(30)  NULL,
        Address   NVARCHAR(255) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      )
    END
  `);

  // 2. Products
  await pool.request().query(`
    IF OBJECT_ID('dbo.Products', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Products (
        Id          INT IDENTITY(1,1) PRIMARY KEY,
        Name        NVARCHAR(120)  NOT NULL,
        Description NVARCHAR(500)  NOT NULL,
        Price       DECIMAL(10,2)  NOT NULL,
        ImageUrl    NVARCHAR(500)  NULL,
        Category    NVARCHAR(80)   NOT NULL DEFAULT 'General',
        Stock       INT            NOT NULL DEFAULT 0,
        CreatedAt   DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
      )
    END
  `);

  // 3. Orders (FK -> Users)
  await pool.request().query(`
    IF OBJECT_ID('dbo.Orders', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Orders (
        Id          INT IDENTITY(1,1) PRIMARY KEY,
        UserId      INT           NOT NULL,
        Status      NVARCHAR(50)  NOT NULL DEFAULT 'Pending',
        TotalAmount DECIMAL(10,2) NOT NULL DEFAULT 0,
        CreatedAt   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Orders_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
      )
    END
  `);

  // 4. OrderItems (FK -> Orders, FK -> Products)
  await pool.request().query(`
    IF OBJECT_ID('dbo.OrderItems', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.OrderItems (
        Id        INT IDENTITY(1,1) PRIMARY KEY,
        OrderId   INT           NOT NULL,
        ProductId INT           NOT NULL,
        Quantity  INT           NOT NULL DEFAULT 1,
        UnitPrice DECIMAL(10,2) NOT NULL,
        CONSTRAINT FK_OrderItems_Orders   FOREIGN KEY (OrderId)   REFERENCES dbo.Orders(Id),
        CONSTRAINT FK_OrderItems_Products FOREIGN KEY (ProductId) REFERENCES dbo.Products(Id)
      )
    END
  `);

  // 5. ContactMessages (FK -> Users optional, guests can also contact)
  await pool.request().query(`
    IF OBJECT_ID('dbo.ContactMessages', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.ContactMessages (
        Id        INT IDENTITY(1,1) PRIMARY KEY,
        UserId    INT           NULL,
        FullName  NVARCHAR(120) NOT NULL,
        Email     NVARCHAR(255) NOT NULL,
        Subject   NVARCHAR(255) NOT NULL,
        Message   NVARCHAR(MAX) NOT NULL,
        CreatedAt DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_ContactMessages_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
      )
    END
  `);

  // Seed Products nếu chưa có dữ liệu
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM dbo.Products)
    BEGIN
      INSERT INTO dbo.Products (Name, Description, Price, ImageUrl, Category, Stock) VALUES
      (
        'Classic Black Suit',
        'Tailored silhouette with sharp formal lines.',
        299.00,
        'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=900&auto=format&fit=crop',
        'Men',
        50
      ),
      (
        'Minimal White Dress',
        'Lightweight fabric for elegant daily wear.',
        159.00,
        'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=900&auto=format&fit=crop',
        'Women',
        80
      ),
      (
        'Urban Gray Coat',
        'Structured outerwear with modern minimal detail.',
        210.00,
        'https://images.unsplash.com/photo-1520975954732-35dd22299614?w=900&auto=format&fit=crop',
        'Unisex',
        35
      )
    END
  `);
}

module.exports = {
  sql,
  getPool,
  initializeDatabase
};
