<?php
declare(strict_types=1);

namespace SneakerLab;

use PDO;

/** Envoltorio mínimo sobre PDO (MySQL 8 / MariaDB 10.6+). Las columnas JSON se devuelven como texto. */
final class Db
{
    public readonly PDO $pdo;

    public function __construct(Config $config)
    {
        $this->pdo = new PDO($config->dbDsn, $config->dbUser, $config->dbPassword, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_STRINGIFY_FETCHES => false,
        ]);
        $this->pdo->exec("SET time_zone = '+00:00'");
    }

    /** @param array<string|int,mixed> $params */
    public function run(string $sql, array $params = []): \PDOStatement
    {
        $st = $this->pdo->prepare($sql);
        foreach ($params as $k => $v) {
            $type = match (true) {
                is_bool($v) => PDO::PARAM_BOOL,
                is_int($v) => PDO::PARAM_INT,
                $v === null => PDO::PARAM_NULL,
                default => PDO::PARAM_STR,
            };
            $st->bindValue(is_int($k) ? $k + 1 : ':' . ltrim($k, ':'), $v, $type);
        }
        $st->execute();
        return $st;
    }

    /** @return array<string,mixed>|null */
    public function one(string $sql, array $params = []): ?array
    {
        $row = $this->run($sql, $params)->fetch();
        return $row === false ? null : $row;
    }

    /** @return list<array<string,mixed>> */
    public function all(string $sql, array $params = []): array
    {
        return $this->run($sql, $params)->fetchAll();
    }

    /** @param array<string,mixed> $values */
    public function insert(string $table, array $values): void
    {
        $cols = array_keys($values);
        $sql = sprintf('INSERT INTO `%s` (%s) VALUES (%s)', $table, implode(',', array_map(fn ($c) => "`$c`", $cols)), implode(',', array_map(fn ($c) => ":$c", $cols)));
        $this->run($sql, $values);
    }

    /** @param array<string,mixed> $values */
    public function update(string $table, array $values, string $id): int
    {
        $set = implode(',', array_map(fn ($c) => "`$c` = :$c", array_keys($values)));
        return $this->run("UPDATE `$table` SET $set WHERE id = :__id", $values + ['__id' => $id])->rowCount();
    }

    public function transaction(callable $fn): mixed
    {
        $this->pdo->beginTransaction();
        try {
            $r = $fn();
            $this->pdo->commit();
            return $r;
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }
}
