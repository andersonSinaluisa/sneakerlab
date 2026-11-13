<?php
declare(strict_types=1);

namespace SneakerLab;

/** @internal */
final class ValidationIssue extends \RuntimeException
{
    /** @param string[] $issues */
    public function __construct(public readonly array $issues)
    {
        parent::__construct(implode('; ', $issues));
    }
}
