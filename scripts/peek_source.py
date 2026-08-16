import openpyxl
wb = openpyxl.load_workbook('db_30 Jul 2026.xlsx', data_only=True, read_only=True)
ws = wb['source_data']
rows_iter = ws.iter_rows(min_row=1, max_row=3, values_only=True)
headers = [str(c) for c in next(rows_iter)]
print('source_data columns:')
for i, h in enumerate(headers[:40]):
    print('  %d: %s' % (i, repr(h)))
print('\nSample row 1:')
row1 = next(rows_iter)
for i, v in enumerate(list(row1)[:25]):
    h = headers[i] if i < len(headers) else '?'
    print('  %d [%s]: %s' % (i, h, repr(str(v)[:50])))
